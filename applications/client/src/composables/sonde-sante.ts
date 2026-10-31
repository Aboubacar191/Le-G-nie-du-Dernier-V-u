// Sonde de santé du serveur — correctif de ANO-UX-01.
//
// CE QUI S'EST PASSÉ, ET POURQUOI AUCUN TEST NE L'AVAIT VU
// L'écran d'accueil sondait /api/sante UNE SEULE FOIS au montage et figeait
// `serveurInjoignable`. L'utilisateur a chargé la page pendant que le serveur
// était tombé : les deux boutons sont restés morts, sans jamais revérifier, et
// il a conclu que l'application était cassée. Trois minutes de test réel ont
// trouvé ce que 531 tests automatisés n'avaient pas vu, parce que tous
// mesuraient un INSTANT et aucun ne mesurait la SUITE du temps.
//
// Sur un jeu en présentiel où huit téléphones rejoignent le même Wi-Fi en même
// temps, le premier à charger pendant un micro-incident reste bloqué sans
// recours. C'est la situation nominale, pas le cas limite.
//
// POLITIQUE DE RELANCE : AUCUNE VALEUR NOUVELLE
// La cadence est celle du canal temps réel — delaiAvecGigue et
// DELAIS_RECONNEXION_MS (0,5 / 1 / 2 / 4 / 8 s, gigue de 20 %). Deux raisons de
// la réemployer plutôt que d'inventer un intervalle :
//   · la GIGUE est indispensable ici et pas seulement là-bas. Huit téléphones
//     qui perdent le réseau au même instant et le retrouvent au même instant
//     reviendraient tous ensemble sur /api/sante : la sonde de disponibilité
//     deviendrait elle-même la cause de l'indisponibilité ;
//   · une seconde politique de réessai dans la même application, c'est une
//     politique de plus à maintenir et à faire divergier.
// En échec, la relance part de 0,5 s : la reprise est quasi immédiate dès que le
// serveur revient. En succès, elle se stabilise au palier de 8 s : une panne qui
// survient pendant que le joueur lit l'accueil est vue en 8 s au plus.
//
// DEUX RELANCES IMMÉDIATES, en plus du rythme : au retour au premier plan
// (visibilitychange) et au retour du réseau (online). C'est le cas réel — le
// joueur déverrouille son téléphone, ou le Wi-Fi se raccroche — et attendre le
// prochain pas serait attendre pour rien.

import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue';

import { DELAIS_RECONNEXION_MS, delaiAvecGigue } from '../transport/client-ws.ts';
import { sonderSante } from '../transport/rest.ts';

/**
 * États de la sonde. « inconnu » n'est pas « injoignable » : tant que la
 * première réponse n'est pas arrivée, rien ne permet d'affirmer que le serveur
 * est en panne, et les actions ne doivent donc pas être présentées comme
 * bloquées. C'est la différence entre « on vérifie » et « c'est cassé ».
 */
export type EtatSonde = 'inconnu' | 'joignable' | 'injoignable';

/** Indice du palier : au-delà, delaiAvecGigue plafonne de lui-même. */
const PALIER = DELAIS_RECONNEXION_MS.length - 1;

export interface OptionsSonde {
  /** Injectable pour le test : aucune horloge ni aucun réseau implicites. */
  readonly sonder?: () => Promise<{ readonly ok: boolean }>;
  readonly alea?: () => number;
  readonly planifier?: (rappel: () => void, delaiMs: number) => unknown;
  readonly annuler?: (poignee: unknown) => void;
  /** Faux dans les tests : pas de document ni de fenêtre à écouter. */
  readonly ecouterLeContexte?: boolean;
}

export interface Sonde {
  readonly etat: Readonly<Ref<EtatSonde>>;
  /** Nombre d'échecs consécutifs. Remis à zéro dès la première réponse. */
  readonly echecs: Readonly<Ref<number>>;
  /** Sonde tout de suite : employé par la reprise explicite du bandeau. */
  readonly relancer: () => void;
  readonly arreter: () => void;
}

/** État interne d'une sonde. Mutable, et volontairement local au module. */
interface Contexte {
  readonly sonder: () => Promise<{ readonly ok: boolean }>;
  readonly alea: () => number;
  readonly planifier: (rappel: () => void, delaiMs: number) => unknown;
  readonly annuler: (poignee: unknown) => void;
  readonly etat: Ref<EtatSonde>;
  readonly echecs: Ref<number>;
  poignee: unknown;
  vivante: boolean;
  /** Évite deux sondes simultanées quand une relance immédiate se superpose. */
  enCours: boolean;
}

function desarmer(ctx: Contexte): void {
  if (ctx.poignee !== null) ctx.annuler(ctx.poignee);
  ctx.poignee = null;
}

function armer(ctx: Contexte, delaiMs: number): void {
  desarmer(ctx);
  if (!ctx.vivante) return;
  ctx.poignee = ctx.planifier(() => {
    ctx.poignee = null;
    void battre(ctx);
  }, delaiMs);
}

async function battre(ctx: Contexte): Promise<void> {
  if (!ctx.vivante || ctx.enCours) return;
  ctx.enCours = true;
  let joignable = false;
  try {
    joignable = (await ctx.sonder()).ok;
  } finally {
    ctx.enCours = false;
  }
  if (!ctx.vivante) return;

  if (joignable) {
    // REPRISE AUTOMATIQUE : l'état repasse à joignable sans action du joueur, et
    // les actions se réactivent d'elles-mêmes. C'est tout le correctif.
    ctx.etat.value = 'joignable';
    ctx.echecs.value = 0;
    armer(ctx, delaiAvecGigue(PALIER, ctx.alea));
    return;
  }
  ctx.etat.value = 'injoignable';
  armer(ctx, delaiAvecGigue(ctx.echecs.value, ctx.alea));
  ctx.echecs.value += 1;
}

/**
 * Sonde périodique de disponibilité du serveur, avec reprise automatique.
 *
 * Ne décide de rien : elle publie un état. C'est l'écran qui choisit ce qu'il
 * en fait, et la règle de gestion reste au serveur.
 */
export function utiliserSondeSante(options: OptionsSonde = {}): Sonde {
  const ctx: Contexte = {
    sonder: options.sonder ?? sonderSante,
    alea: options.alea ?? Math.random,
    planifier: options.planifier ?? ((rappel, delai) => setTimeout(rappel, delai)),
    annuler: options.annuler ?? ((poignee) => { clearTimeout(poignee as never); }),
    etat: ref<EtatSonde>('inconnu'),
    echecs: ref(0),
    poignee: null,
    vivante: true,
    enCours: false,
  };
  const ecouter = options.ecouterLeContexte ?? true;

  const relancer = (): void => {
    desarmer(ctx);
    void battre(ctx);
  };
  const auRetourAuPremierPlan = (): void => {
    if (globalThis.document.visibilityState === 'visible') relancer();
  };
  const retirerEcoutes = (): void => {
    globalThis.document.removeEventListener('visibilitychange', auRetourAuPremierPlan);
    globalThis.removeEventListener('online', relancer);
  };
  const arreter = (): void => {
    ctx.vivante = false;
    desarmer(ctx);
    if (ecouter) retirerEcoutes();
  };

  if (ecouter) {
    globalThis.document.addEventListener('visibilitychange', auRetourAuPremierPlan);
    globalThis.addEventListener('online', relancer);
  }
  // Hors d'un composant (cas des tests), il n'y a pas de portée à laquelle se
  // raccrocher : l'appelant arrête la sonde lui-même.
  if (getCurrentScope() !== undefined) onScopeDispose(arreter);
  void battre(ctx);

  return { etat: readonly(ctx.etat), echecs: readonly(ctx.echecs), relancer, arreter };
}
