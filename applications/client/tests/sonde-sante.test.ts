// PREUVE — la sonde de santé RELANCE, et l'application se reprend toute seule
// dès que le serveur revient (ANO-UX-01).
//
// Ce que 531 tests automatisés n'avaient pas vu et qu'un utilisateur a trouvé en
// trois minutes : l'écran d'accueil sondait une seule fois, puis figeait son
// verdict. Tous les tests existants mesuraient un INSTANT ; aucun ne mesurait la
// SUITE du temps. C'est le défaut de méthode que ce fichier corrige, pas
// seulement le défaut de code — chaque cas ci-dessous fait passer plusieurs pas
// de temps et vérifie l'état APRÈS.
//
// Le temps et l'aléa sont injectés : aucune minuterie réelle, aucun réseau,
// aucune attente. Un test de reprise qui dort huit secondes n'est pas rejoué.

import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { utiliserSondeSante } from '../src/composables/sonde-sante.ts';
import { DELAIS_RECONNEXION_MS, GIGUE_RELATIVE } from '../src/transport/client-ws.ts';

/** Minuteries contrôlées : rien ne s'exécute avant qu'on ne le demande. */
function creerHorloge() {
  const attentes = new Map<number, { rappel: () => void; delai: number }>();
  let suivant = 1;
  return {
    planifier: (rappel: () => void, delai: number): unknown => {
      const poignee = suivant;
      suivant += 1;
      attentes.set(poignee, { rappel, delai });
      return poignee;
    },
    annuler: (poignee: unknown): void => {
      attentes.delete(poignee as number);
    },
    /** Délais actuellement armés, dans l'ordre d'armement. */
    delais: (): readonly number[] => [...attentes.values()].map((attente) => attente.delai),
    /** Déclenche toutes les minuteries armées, puis laisse les promesses filer. */
    battre: async (): Promise<void> => {
      for (const [poignee, attente] of [...attentes]) {
        attentes.delete(poignee);
        attente.rappel();
      }
      await Promise.resolve();
      await Promise.resolve();
    },
    enAttente: (): number => attentes.size,
  };
}

const laisserFiler = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

interface Serveur {
  readonly sonder: () => Promise<{ ok: boolean }>;
  appels: number;
  joignable: boolean;
}

function creerServeur(joignable: boolean): Serveur {
  const serveur: Serveur = {
    joignable,
    appels: 0,
    sonder: () => {
      serveur.appels += 1;
      return Promise.resolve({ ok: serveur.joignable });
    },
  };
  return serveur;
}

/** Aléa fixé au centre : la gigue vaut 1, les délais sont ceux du palier. */
const aleaCentre = (): number => 0.5;

function monter(serveur: Serveur, horloge: ReturnType<typeof creerHorloge>) {
  return utiliserSondeSante({
    sonder: serveur.sonder,
    alea: aleaCentre,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
    ecouterLeContexte: false,
  });
}

test('tant que la première réponse n’est pas arrivée, l’état est « inconnu »', () => {
  const serveur = creerServeur(true);
  const sonde = monter(serveur, creerHorloge());
  // Et pas « injoignable » : annoncer la panne avant d'avoir attendu la réponse
  // est le faux négatif qui fait conclure que l'application est cassée.
  assert.equal(sonde.etat.value, 'inconnu');
  sonde.arreter();
});

test('un serveur absent au premier appel N’EST PAS un verdict définitif', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();

  assert.equal(sonde.etat.value, 'injoignable');
  // Le défaut corrigé : une relance est ARMÉE. Avant, il n'y en avait aucune.
  assert.equal(horloge.enAttente(), 1, 'aucune relance armée : l’état resterait figé');
  sonde.arreter();
});

test('REPRISE AUTOMATIQUE : le serveur revient, l’état suit, sans geste du joueur', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();
  assert.equal(sonde.etat.value, 'injoignable');

  // Le serveur redémarre. Personne ne touche à l'écran.
  serveur.joignable = true;
  await horloge.battre();
  await laisserFiler();

  assert.equal(sonde.etat.value, 'joignable');
  assert.equal(sonde.echecs.value, 0, 'le compteur d’échecs doit repartir de zéro');
  assert.ok(horloge.enAttente() >= 1, 'la surveillance continue après la reprise');
  sonde.arreter();
});

test('la relance suit la politique du canal temps réel, gigue comprise', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();

  // Aléa au centre : le facteur de gigue vaut exactement 1.
  assert.equal(horloge.delais()[0], DELAIS_RECONNEXION_MS[0]);
  await horloge.battre();
  await laisserFiler();
  assert.equal(horloge.delais()[0], DELAIS_RECONNEXION_MS[1]);
  await horloge.battre();
  await laisserFiler();
  assert.equal(horloge.delais()[0], DELAIS_RECONNEXION_MS[2]);
  sonde.arreter();
});

test('la relance PLAFONNE : une panne longue ne devient pas une attente infinie', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();

  for (let pas = 0; pas < DELAIS_RECONNEXION_MS.length + 3; pas += 1) {
    await horloge.battre();
    await laisserFiler();
  }
  const palier = DELAIS_RECONNEXION_MS[DELAIS_RECONNEXION_MS.length - 1] ?? 0;
  assert.equal(horloge.delais()[0], palier, `la relance doit plafonner à ${String(palier)} ms`);
  sonde.arreter();
});

test('une panne qui survient APRÈS la reprise est vue au pas de surveillance', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(true);
  const sonde = monter(serveur, horloge);
  await laisserFiler();
  assert.equal(sonde.etat.value, 'joignable');

  // En succès, la surveillance se stabilise au palier : une panne survenue
  // pendant que le joueur lit l'accueil est vue au pas suivant.
  const palier = DELAIS_RECONNEXION_MS[DELAIS_RECONNEXION_MS.length - 1] ?? 0;
  assert.equal(horloge.delais()[0], palier);

  serveur.joignable = false;
  await horloge.battre();
  await laisserFiler();
  assert.equal(sonde.etat.value, 'injoignable');
  sonde.arreter();
});

test('la gigue est RÉELLE : huit téléphones ne reviennent pas au même instant', async () => {
  // Huit joueurs qui perdent le Wi-Fi ensemble et le retrouvent ensemble
  // reviendraient tous sur /api/sante au même millième de seconde : la sonde de
  // disponibilité deviendrait la cause de l'indisponibilité.
  const delais = new Set<number>();
  for (const graine of [0, 0.25, 0.5, 0.75, 1]) {
    const horloge = creerHorloge();
    const serveur = creerServeur(false);
    const sonde = utiliserSondeSante({
      sonder: serveur.sonder,
      alea: () => graine,
      planifier: horloge.planifier,
      annuler: horloge.annuler,
      ecouterLeContexte: false,
    });
    await laisserFiler();
    delais.add(horloge.delais()[0] ?? 0);
    sonde.arreter();
  }
  assert.ok(delais.size >= 3, `la gigue doit disperser les relances, obtenu ${delais.size} valeurs`);

  const base = DELAIS_RECONNEXION_MS[0] ?? 0;
  for (const delai of delais) {
    assert.ok(delai >= Math.round(base * (1 - GIGUE_RELATIVE)));
    assert.ok(delai <= Math.round(base * (1 + GIGUE_RELATIVE)));
  }
});

test('« Réessayer » SONDE vraiment, au lieu de masquer le bandeau', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();
  const avant = serveur.appels;

  sonde.relancer();
  await laisserFiler();

  assert.equal(serveur.appels, avant + 1, 'la reprise doit appeler la sonde');
  assert.equal(sonde.etat.value, 'injoignable', 'un serveur toujours absent reste absent');
  sonde.arreter();
});

test('une sonde arrêtée n’appelle plus rien : aucune minuterie ne survit', async () => {
  const horloge = creerHorloge();
  const serveur = creerServeur(false);
  const sonde = monter(serveur, horloge);
  await laisserFiler();

  sonde.arreter();
  const apresArret = serveur.appels;
  await horloge.battre();
  await laisserFiler();

  assert.equal(horloge.enAttente(), 0, 'une minuterie a survécu à l’arrêt');
  assert.equal(serveur.appels, apresArret, 'la sonde a continué après son arrêt');
});

test('l’écran d’accueil ne traite PAS « inconnu » comme une panne', () => {
  const accueil = readFileSync(
    new URL('../src/vues/EcranAccueil.vue', import.meta.url),
    'utf8',
  );
  assert.match(
    accueil,
    /sonde\.etat\.value === 'injoignable'/u,
    'seul l’état mesuré « injoignable » doit désactiver les actions',
  );
  // L'ancien correctif de façade : remettre l'indicateur à faux sans sonder.
  assert.ok(
    !/@reprendre="serveurInjoignable = false"/u.test(accueil),
    'la reprise ne doit pas se contenter de masquer le bandeau',
  );
  assert.match(accueil, /@reprendre="sonde\.relancer\(\)"/u);
});
