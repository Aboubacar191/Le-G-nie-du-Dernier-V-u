// PREUVE — le transport respecte x-temps-reel : authentifier en PREMIÈRE trame,
// corrélation, reconnexion avec gigue, détection de trou de séquence suivie
// d'une RE-PROJECTION et jamais d'un rejeu.
//
// Et : les 30 types d'événement du contrat sont appliqués par le magasin.

import test from 'node:test';
import assert from 'node:assert/strict';

import { FERMETURE, TYPES_EVENEMENT, type EnveloppeEvenement } from '@gdv/partage';

import {
  creerClientTempsReel,
  delaiAvecGigue,
  DELAIS_RECONNEXION_MS,
  GIGUE_RELATIVE,
  type EtatLiaison,
  type WebSocketCompatible,
} from '../src/transport/client-ws.ts';
import {
  CLE_STOCKAGE_JETON,
  ecrireJeton,
  purgerJeton,
  relireJeton,
  type JetonStocke,
  type StockageLocal,
} from '../src/transport/stockage-jeton.ts';
import { APPLICATEURS, TYPES_NON_COUVERTS, appliquerEvenement } from '../src/magasin/reducteurs.ts';
import { etatInitial } from '../src/magasin/etat.ts';

function stockageMemoire(): StockageLocal & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: (cle) => contenu.get(cle) ?? null,
    setItem: (cle, valeur) => void contenu.set(cle, valeur),
    removeItem: (cle) => void contenu.delete(cle),
  };
}

interface SocketEspion extends WebSocketCompatible {
  readonly envoyees: string[];
  readonly fermetures: number[];
}

function socketEspion(): SocketEspion {
  const envoyees: string[] = [];
  const fermetures: number[] = [];
  return {
    envoyees,
    fermetures,
    send: (donnees) => void envoyees.push(donnees),
    close: (code) => void fermetures.push(code ?? 1000),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
}

const enveloppe = (
  type: string,
  sequence: number,
  charge: Record<string, unknown> = {},
): EnveloppeEvenement =>
  ({ type, sequence, emis_a: '2026-10-28T20:00:00.000Z', charge }) as EnveloppeEvenement;

interface Montage {
  readonly client: ReturnType<typeof creerClientTempsReel>;
  readonly socket: SocketEspion;
  readonly liaisons: EtatLiaison[];
  readonly trous: [number, number][];
  readonly recus: EnveloppeEvenement[];
}

function monter(): Montage {
  const socket = socketEspion();
  const liaisons: EtatLiaison[] = [];
  const trous: [number, number][] = [];
  const recus: EnveloppeEvenement[] = [];
  const client = creerClientTempsReel({
    url: 'ws://127.0.0.1:8443/tr',
    jetonSession: 'a'.repeat(43),
    versionProtocole: '1.0.0',
    surEvenement: (recue) => void recus.push(recue),
    surLiaison: (etat) => void liaisons.push(etat),
    surTrouDeSequence: (attendue, recue) => void trous.push([attendue, recue]),
    fabriquerSocket: () => socket,
    maintenant: () => 0,
    alea: () => 0.5,
    identifiant: () => 'correlation-fixe',
  });
  return { client, socket, liaisons, trous, recus };
}

test('la PREMIÈRE trame envoyée est authentifier, et rien d’autre', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});

  assert.equal(montage.socket.envoyees.length, 1);
  const premiere = JSON.parse(montage.socket.envoyees[0] as string) as {
    type: string;
    id_correlation: string;
    charge: Record<string, unknown>;
  };
  assert.equal(premiere.type, 'authentifier');
  assert.equal(premiere.charge.version_protocole, '1.0.0');
  assert.equal(premiere.id_correlation, 'correlation-fixe');
  montage.client.fermer();
});

test('aucune commande ne porte l’identifiant de son auteur (CA-44)', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('etat_complet_prive', 1)) });
  montage.client.envoyer('declarer_contribution', { montant: 4 });

  const derniere = JSON.parse(montage.socket.envoyees.at(-1) as string) as {
    charge: Record<string, unknown>;
  };
  // L'émetteur est DÉDUIT de la connexion authentifiée.
  for (const champ of ['joueur_id', 'auteur_joueur_id', 'emetteur_joueur_id']) {
    assert.equal(derniere.charge[champ], undefined, `${champ} ne doit pas circuler`);
  }
  montage.client.fermer();
});

test('aucune commande n’est émise tant que la liaison n’est pas établie (RG-30)', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  // Authentification pas encore confirmée : la commande est REFUSÉE, pas mise
  // en file. Une commande différée arriverait dans une autre phase.
  assert.throws(() => montage.client.envoyer('payer_secret', { montant: 3 }));
  assert.equal(montage.socket.envoyees.length, 1, 'seule authentifier a été émise');
  montage.client.fermer();
});

test('etat_complet_prive établit la liaison et REMET la séquence à 1', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('etat_complet_prive', 1)) });

  assert.equal(montage.client.etat(), 'etablie');
  // Les séquences repartent de 2 : aucun trou n'est signalé.
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('phase_changee', 2)) });
  assert.deepEqual(montage.trous, []);
  montage.client.fermer();
});

test('un TROU de séquence est signalé, sans tentative de reconstitution locale', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('etat_complet_prive', 1)) });
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('phase_changee', 2)) });
  // La séquence 3 manque.
  montage.socket.onmessage?.({ data: JSON.stringify(enveloppe('declaration_publiee', 4)) });

  assert.deepEqual(montage.trous, [[3, 4]]);
  // Le client n'a RIEN rejoué, et il a transmis les deux trames reçues telles
  // quelles : la reprise est une re-projection, décidée par le porteur.
  assert.equal(montage.recus.length, 3);
  montage.client.fermer();
});

test('une trame illisible est ignorée sans faire tomber la liaison', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  montage.socket.onmessage?.({ data: '{ pas du json' });
  montage.socket.onmessage?.({ data: 42 });
  assert.equal(montage.recus.length, 0);
  assert.ok(!montage.liaisons.includes('perdue'));
  montage.client.fermer();
});

test('une fermeture ordinaire déclenche une reconnexion ; 4401 ne la déclenche pas', () => {
  const montage = monter();
  montage.client.connecter();
  montage.socket.onopen?.({});
  montage.socket.onclose?.({ code: 1006, reason: '' });
  assert.ok(montage.liaisons.includes('perdue'));
  montage.client.fermer();

  const refuse = monter();
  refuse.client.connecter();
  refuse.socket.onopen?.({});
  refuse.socket.onclose?.({ code: FERMETURE.jetonInvalide, reason: '' });
  assert.equal(refuse.liaisons.at(-1), 'refusee', 'un jeton mort ne se retente pas');
  refuse.client.fermer();
});

test('la relance exponentielle suit le contrat, avec une gigue bornée', () => {
  for (const [tentative, attendu] of DELAIS_RECONNEXION_MS.entries()) {
    assert.equal(delaiAvecGigue(tentative, () => 0.5), attendu, 'gigue neutre = délai nominal');
    const bas = delaiAvecGigue(tentative, () => 0);
    const haut = delaiAvecGigue(tentative, () => 1);
    assert.equal(bas, Math.round(attendu * (1 - GIGUE_RELATIVE)));
    assert.equal(haut, Math.round(attendu * (1 + GIGUE_RELATIVE)));
  }
  // Palier : au-delà de la dernière entrée, le délai ne croît plus.
  const palier = DELAIS_RECONNEXION_MS.at(-1) as number;
  assert.equal(delaiAvecGigue(99, () => 0.5), palier);
});

// --- Stockage du jeton --------------------------------------------------------

const JETON: JetonStocke = Object.freeze({
  session_id: 'session-1',
  jeton_session: 'b'.repeat(43),
  joueur_id: 'joueur-1',
  est_hote: true,
  url_temps_reel: '/tr',
});

test('le jeton se relit à l’identique, et se purge', () => {
  const stockage = stockageMemoire();
  ecrireJeton(stockage, JETON);
  assert.deepEqual(relireJeton(stockage), JETON);
  purgerJeton(stockage);
  assert.equal(relireJeton(stockage), null);
});

test('un jeton stocké partiel ou corrompu vaut une ABSENCE, pas un échec', () => {
  const stockage = stockageMemoire();
  stockage.setItem(CLE_STOCKAGE_JETON, '{"session_id":"s"}');
  assert.equal(relireJeton(stockage), null);
  stockage.setItem(CLE_STOCKAGE_JETON, 'pas du json');
  assert.equal(relireJeton(stockage), null);
});

test('AUCUNE donnée de jeu n’est persistée avec le jeton', () => {
  const stockage = stockageMemoire();
  ecrireJeton(stockage, JETON);
  const brut = stockage.contenu.get(CLE_STOCKAGE_JETON) as string;
  for (const interdit of ['solde', 'role', 'mission', 'clause', 'montant']) {
    assert.ok(!brut.includes(interdit), `${interdit} ne doit pas survivre sur l'appareil`);
  }
});

// --- Couverture des 32 événements --------------------------------------------

test('les 32 types d’événement du contrat ont un applicateur', () => {
  assert.deepEqual([...TYPES_NON_COUVERTS], []);
  assert.equal(TYPES_EVENEMENT.length, 32);
  for (const type of TYPES_EVENEMENT) {
    assert.equal(typeof APPLICATEURS[type], 'function', `${type} non couvert`);
  }
});

test('aucun applicateur ne traite un type absent du contrat', () => {
  const surnumeraires = Object.keys(APPLICATEURS).filter(
    (type) => !(TYPES_EVENEMENT as readonly string[]).includes(type),
  );
  assert.deepEqual(surnumeraires, [], `types inventés : ${surnumeraires.join(', ')}`);
});

test('chaque enveloppe reçue alimente la mesure du décalage d’horloge (RG-79)', () => {
  const etat = etatInitial();
  assert.equal(etat.decalage.mesure, false);
  appliquerEvenement(etat, enveloppe('phase_changee', 1, {
    phase: 'VOEU',
    phase_fin_at: '2026-10-28T20:00:20.000Z',
    numero_manche: 1,
    actions_autorisees: [],
  }), Date.parse('2026-10-28T20:00:00.120Z'));
  assert.equal(etat.decalage.mesure, true);
  assert.equal(etat.decalage.decalage_ms, 120);
  assert.equal(etat.phase, 'VOEU');
});

test('un type inconnu n’est pas appliqué en silence : il est signalé', () => {
  const etat = etatInitial();
  appliquerEvenement(etat, enveloppe('type_du_futur', 1), 0);
  assert.notEqual(etat.alerte, null, 'un client plus ancien que le serveur doit le dire');
});
