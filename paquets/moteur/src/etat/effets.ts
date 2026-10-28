// Effets décidés par le moteur, à PROJETER par destinataire avant émission.
//
// Un effet n'est pas un message : c'est une décision. Il peut porter des
// secrets (le montant payé d'un joueur, la clause de la manche, l'identité du
// porteur) parce qu'il ne quitte jamais le serveur. Seule
// projeterEvenement(etat, effet, destinataire) produit une charge, et elle la
// construit par AJOUT de ce qui est autorisé (ADR-TL-09, RG-01).
//
// Le champ `type` est le type d'événement du protocole : la table des
// projections est donc totale sur les 30 types, et un type ajouté au contrat
// sans projection ne compile pas.

import { TYPES_EVENEMENT } from '@gdv/partage';
import type { Clause, ConsequenceDernierVoeu, MotifAbandon, Verdict } from '@gdv/partage';

import type { Accusation, Pret, RevelationEmise } from './types.ts';

/**
 * Types d'effet, à l'exécution. Ils sont EXACTEMENT les types d'événement du
 * protocole : un effet est une décision qui se projette en un message, et il
 * n'existe pas de décision sans message correspondant au contrat.
 *
 * La liste existe à l'exécution — et pas seulement dans les types — pour que la
 * TOTALITÉ de la table de projection soit vérifiable par un test et pas
 * seulement par le compilateur : une table qui compile peut quand même oublier
 * un cas si quelqu'un l'élargit avec un index signature.
 */
export const TYPES_EFFET: readonly string[] = TYPES_EVENEMENT;

export interface EffetAccuseReception {
  readonly type: 'accuse_reception';
  readonly auteur_joueur_id: string;
  readonly id_correlation: string;
  readonly type_commande: string;
}

export interface EffetErreur {
  readonly type: 'erreur';
  readonly auteur_joueur_id: string;
  readonly code: string;
  readonly message: string;
  readonly id_correlation: string | null;
}

export interface EffetEtatCompletPrive {
  readonly type: 'etat_complet_prive';
  readonly destinataire_joueur_id: string;
}

export interface EffetEtatPartieChange {
  readonly type: 'etat_partie_change';
}

export interface EffetJoueurRejoint {
  readonly type: 'joueur_rejoint';
  readonly joueur_id: string;
}

export interface EffetPresence {
  readonly type: 'joueur_quitte' | 'joueur_reconnecte';
  readonly joueur_id: string;
}

export interface EffetPartieDemarree {
  readonly type: 'partie_demarree';
}

export interface EffetAttributionPrivee {
  readonly type: 'attribution_privee';
  readonly joueur_id: string;
}

export interface EffetVoeuAnnonce {
  readonly type: 'voeu_annonce';
  readonly numero_manche: number;
}

export interface EffetClauseRecue {
  readonly type: 'clause_recue';
  readonly numero_manche: number;
  readonly clause: Clause;
  readonly porteur_joueur_id: string;
}

export interface EffetPhaseChangee {
  readonly type: 'phase_changee';
}

export interface EffetDeclarationPubliee {
  readonly type: 'declaration_publiee';
  readonly joueur_id: string;
  readonly montant_declare: number;
}

export interface EffetPaiementEnregistre {
  readonly type: 'paiement_enregistre';
  readonly joueur_id: string;
  readonly numero_manche: number;
}

export interface EffetTransfertEnregistre {
  readonly type: 'transfert_enregistre';
  readonly emetteur_joueur_id: string;
  readonly destinataire_joueur_id: string;
  readonly montant: number;
}

export interface EffetPretPropose {
  readonly type: 'pret_propose';
  readonly pret: Pret;
}

export interface EffetPretResolu {
  readonly type: 'pret_resolu';
  readonly pret: Pret;
  readonly accepte: boolean;
}

export interface EffetPretPreleve {
  readonly type: 'pret_preleve';
  readonly pret: Pret;
  readonly montant_preleve: number;
  readonly reliquat_du: number;
}

export interface EffetRevelationEcartTotal {
  readonly type: 'revelation_ecart_total';
  readonly numero_manche: number;
  readonly total_declare: number;
  readonly total_paye: number;
}

export interface EffetRevelation {
  readonly type: 'revelation';
  readonly numero_manche: number;
  readonly revelation: RevelationEmise;
}

export interface EffetResultatEnquete {
  readonly type: 'resultat_enquete';
  readonly enqueteur_joueur_id: string;
  readonly cible_joueur_id: string;
  readonly montant_paye: number;
  readonly montant_declare: number;
  readonly cout_paye: number;
  readonly numero_manche: number;
}

export interface EffetAccusationDeclaree {
  readonly type: 'accusation_declaree';
  readonly accusation: Accusation;
  readonly numero_manche: number;
}

export interface EffetAccusationResolue {
  readonly type: 'accusation_resolue';
  readonly accusation_id: string;
  readonly verdict: Verdict;
}

export interface EffetExecutionResultat {
  readonly type: 'execution_resultat';
  readonly numero_manche: number;
}

export interface EffetSoldeMisAJour {
  readonly type: 'solde_mis_a_jour';
  readonly joueur_id: string;
}

export interface EffetDernierVoeuPropose {
  readonly type: 'dernier_voeu_propose';
  readonly joueur_id: string;
}

export interface EffetDernierVoeuResolu {
  readonly type: 'dernier_voeu_resolu';
  readonly nb_signataires: number;
  readonly consequence: ConsequenceDernierVoeu;
  readonly genie_libere: boolean;
}

export interface EffetScoresFinaux {
  readonly type: 'scores_finaux';
}

export interface EffetPartieAbandonnee {
  readonly type: 'partie_abandonnee';
  readonly motif_abandon: MotifAbandon;
}

export interface EffetGroupeMisAJour {
  readonly type: 'groupe_mis_a_jour';
}

export type Effet =
  | EffetAccuseReception
  | EffetErreur
  | EffetEtatCompletPrive
  | EffetEtatPartieChange
  | EffetJoueurRejoint
  | EffetPresence
  | EffetPartieDemarree
  | EffetAttributionPrivee
  | EffetVoeuAnnonce
  | EffetClauseRecue
  | EffetPhaseChangee
  | EffetDeclarationPubliee
  | EffetPaiementEnregistre
  | EffetTransfertEnregistre
  | EffetPretPropose
  | EffetPretResolu
  | EffetPretPreleve
  | EffetRevelationEcartTotal
  | EffetRevelation
  | EffetResultatEnquete
  | EffetAccusationDeclaree
  | EffetAccusationResolue
  | EffetExecutionResultat
  | EffetSoldeMisAJour
  | EffetDernierVoeuPropose
  | EffetDernierVoeuResolu
  | EffetScoresFinaux
  | EffetPartieAbandonnee
  | EffetGroupeMisAJour;
