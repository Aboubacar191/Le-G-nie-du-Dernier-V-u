// Machine à états de manche — RG-30.
//
// « Les six phases s'enchaînent dans l'ordre VOEU, NEGOCIATION,
//   DECLARATION_PAIEMENT, REVELATION, ENQUETES_ACCUSATIONS, EXECUTION, sans
//   saut ni retour. Toute action reçue hors de la phase qui l'autorise est
//   REJETÉE, jamais mise en file. »
//
// L'ordre est une liste, et la phase suivante s'y lit par position : il n'existe
// aucune fonction capable de sauter une phase ou de revenir en arrière.

import type { Phase, TypeCommande } from '@gdv/partage';

import type { ConfigJeu, PhaseMinutee } from '@gdv/partage';

const MS_PAR_SECONDE = 1000;

export const ORDRE_PHASES_MANCHE: readonly Phase[] = [
  'VOEU',
  'NEGOCIATION',
  'DECLARATION_PAIEMENT',
  'REVELATION',
  'ENQUETES_ACCUSATIONS',
  'EXECUTION',
];

export const ORDRE_PHASES_DERNIER_VOEU: readonly Phase[] = [
  'DV_PROPOSITION',
  'DV_DEBAT',
  'DV_SIGNATURE',
  'DV_RESOLUTION',
];

/**
 * Commandes acceptées dans chaque phase. Indication d'affichage pour le client
 * (EvtPhaseChangee.actions_autorisees) ET source de l'autorisation serveur :
 * une seule table, donc aucune divergence possible entre ce que le client
 * affiche et ce que le serveur accepte (RG-71).
 */
export const ACTIONS_PAR_PHASE: Readonly<Record<Phase, readonly TypeCommande[]>> = {
  VOEU: [],
  NEGOCIATION: ['transferer_pieces', 'proposer_pret', 'repondre_pret', 'avancer_phase'],
  DECLARATION_PAIEMENT: ['declarer_contribution', 'payer_secret'],
  REVELATION: [],
  ENQUETES_ACCUSATIONS: ['lancer_enquete', 'accuser'],
  EXECUTION: [],
  DV_PROPOSITION: [],
  DV_DEBAT: [],
  DV_SIGNATURE: ['signer_dernier_voeu'],
  DV_RESOLUTION: [],
};

/** DV_RESOLUTION n'a pas de minuteur : la table des durées ne la porte pas. */
export function estPhaseMinutee(phase: Phase): phase is PhaseMinutee {
  return phase !== 'DV_RESOLUTION';
}

/** Échéance absolue de la phase. Le serveur est l'unique horloge (RG-72). */
export function finDePhase(phase: Phase, config: ConfigJeu, maintenant: number): number {
  if (!estPhaseMinutee(phase)) return maintenant;
  return maintenant + config.durees_phases_s[phase] * MS_PAR_SECONDE;
}

function suivanteDans(ordre: readonly Phase[], phase: Phase): Phase | null {
  const index = ordre.indexOf(phase);
  if (index < 0) return null;
  return ordre[index + 1] ?? null;
}

/**
 * Phase suivante dans la séquence dont la phase courante fait partie.
 * Rend null à la dernière phase de la séquence : c'est à la machine de partie
 * de décider ce qui suit (manche suivante, Dernier Vœu, ou scores).
 */
export function phaseSuivante(phase: Phase): Phase | null {
  return suivanteDans(ORDRE_PHASES_MANCHE, phase) ?? suivanteDans(ORDRE_PHASES_DERNIER_VOEU, phase);
}

/** Une commande est-elle autorisée dans cette phase ? (RG-30, CA-43) */
export function autoriseeEnPhase(phase: Phase | null, commande: TypeCommande): boolean {
  if (phase === null) return false;
  return ACTIONS_PAR_PHASE[phase].includes(commande);
}

export type TransitionPhase = (phase: Phase) => Phase | null;
