// Quel écran afficher — DESIGN / parcours.
//
// « Aucun écran n'est atteint par une navigation libre pendant une manche : le
//   joueur ne choisit pas où il va, la phase le décide (RG-30). »
//
// La résolution est donc une FONCTION de l'état projeté, pas une pile de
// navigation. Les seules surfaces librement navigables sont le panneau privé de
// solde et les réglages, et elles se superposent au lieu de remplacer.
//
// Avant qu'une session existe, il n'y a rien à projeter : les écrans d'accueil,
// de création, d'invitation et d'adhésion sont pilotés par une intention locale.

import type { EtatPartie, Phase } from '@gdv/partage';

export const ECRANS = [
  'ECR-01', 'ECR-02', 'ECR-03', 'ECR-04', 'ECR-05', 'ECR-06', 'ECR-07', 'ECR-08',
  'ECR-09', 'ECR-10', 'ECR-11', 'ECR-12', 'ECR-13', 'ECR-14', 'ECR-15', 'ECR-16',
  'ECR-17', 'ECR-18', 'ECR-19', 'ECR-20', 'ECR-21', 'ECR-22', 'ECR-23', 'ECR-24',
  'ECR-25', 'ECR-26', 'ECR-27', 'ECR-28', 'ECR-29', 'ECR-30', 'ECR-31', 'ECR-32',
] as const;

export type IdEcran = (typeof ECRANS)[number];

/** Intention de navigation AVANT session. Jamais pendant une manche. */
export const INTENTIONS = ['accueil', 'creation', 'reglages', 'invitation', 'adhesion'] as const;
export type IntentionLocale = (typeof INTENTIONS)[number];

/**
 * Surfaces qui se SUPERPOSENT à l'écran de phase au lieu de le remplacer. Les
 * remplacer ferait manquer au joueur le bandeau de phase et son décompte.
 */
export const SURFACES_SUPERPOSEES: readonly IdEcran[] = Object.freeze([
  'ECR-11', 'ECR-13', 'ECR-14', 'ECR-15', 'ECR-20', 'ECR-21', 'ECR-28', 'ECR-29',
]);

export interface ContexteEcran {
  /** Jeton refusé, usurpé ou expiré. Prime sur tout le reste (RG-71). */
  readonly acces_refuse: boolean;
  /** Une session est connue localement et authentifiée. */
  readonly session_active: boolean;
  readonly intention: IntentionLocale;
  readonly etat_partie: EtatPartie | null;
  readonly phase: Phase | null;
  readonly est_hote: boolean;
  /** RG-10 : le paiement n'existe qu'après la déclaration. */
  readonly a_declare: boolean;
  /** Restitution en cours après reconnexion (RG-73). */
  readonly restitution_en_cours: boolean;
}

const ECRAN_PAR_INTENTION: Readonly<Record<IntentionLocale, IdEcran>> = Object.freeze({
  accueil: 'ECR-01',
  creation: 'ECR-02',
  reglages: 'ECR-03',
  invitation: 'ECR-04',
  adhesion: 'ECR-05',
});

const ECRAN_PAR_PHASE_DE_MANCHE: Readonly<Record<Phase, IdEcran>> = Object.freeze({
  VOEU: 'ECR-10',
  NEGOCIATION: 'ECR-12',
  DECLARATION_PAIEMENT: 'ECR-16',
  REVELATION: 'ECR-18',
  ENQUETES_ACCUSATIONS: 'ECR-19',
  EXECUTION: 'ECR-22',
  DV_PROPOSITION: 'ECR-23',
  DV_DEBAT: 'ECR-24',
  DV_SIGNATURE: 'ECR-25',
  DV_RESOLUTION: 'ECR-26',
});

const ECRAN_PAR_ETAT: Readonly<Partial<Record<EtatPartie, IdEcran>>> = Object.freeze({
  CREEE: 'ECR-04',
  SALLE_ATTENTE: 'ECR-06',
  DISTRIBUTION: 'ECR-09',
  SCORES: 'ECR-27',
  TERMINEE: 'ECR-27',
  ABANDONNEE: 'ECR-31',
});

function ecranDePhase(contexte: ContexteEcran): IdEcran {
  if (contexte.phase === null) return 'ECR-10';
  const ecran = ECRAN_PAR_PHASE_DE_MANCHE[contexte.phase];
  // RG-10 : qui a déclaré passe au paiement secret, qui ne l'a pas fait reste
  // sur la déclaration. Les deux actes partagent une fenêtre de 30 s (RG-31).
  if (ecran === 'ECR-16' && contexte.a_declare) return 'ECR-17';
  return ecran;
}

/** Écran de fond, celui qui occupe l'écran et porte le bandeau de phase. */
export function ecranPrincipal(contexte: ContexteEcran): IdEcran {
  if (contexte.acces_refuse) return 'ECR-32';
  if (!contexte.session_active) return ECRAN_PAR_INTENTION[contexte.intention];
  if (contexte.restitution_en_cours) return 'ECR-30';

  const etat = contexte.etat_partie;
  if (etat === null) return 'ECR-06';
  if (etat === 'PLACEMENT') return contexte.est_hote ? 'ECR-07' : 'ECR-08';
  if (etat === 'MANCHE_EN_COURS' || etat === 'DERNIER_VOEU') return ecranDePhase(contexte);
  return ECRAN_PAR_ETAT[etat] ?? 'ECR-06';
}

/** Vrai si l'écran est une surface superposée et non un écran de fond. */
export const estSuperpose = (ecran: IdEcran): boolean => SURFACES_SUPERPOSEES.includes(ecran);
