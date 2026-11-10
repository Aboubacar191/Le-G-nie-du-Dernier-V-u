// =============================================================================
// ÉVÉNEMENTS SERVEUR → CLIENT (EvtXxx dans API-GDV-001.json)
// =============================================================================
// Une charge par événement, transcrite du contrat. Aucune charge n'est
// inventée : outils/verifier-visibilite.mjs et tests/contrat-evenements.test.ts
// échouent si l'énumération, les champs déclarés et les schémas divergent.
//
// Les charges sont des types EXACTS (aucune propriété optionnelle implicite) :
// la projection construit par AJOUT, et un champ qu'un type n'autorise pas ne
// peut pas être ajouté par inadvertance.
//
// Les objets communs à plusieurs charges vivent dans evenements-objets.ts : à
// 335 lignes, ce fichier dépassait la limite de 300 de l'ARCHI, et un fichier
// qu'on ne relit plus est un fichier où une fuite passe.

import type {
  Clause,
  EtatPartie,
  Mission,
  Phase,
  Role,
  Verdict,
} from '../domaine/enums.ts';
import type { CodeErreur } from './codes-erreur.ts';
import type {
  AmendeLiquidee,
  EtatGroupe,
  JoueurPublic,
  LigneClassement,
  PageMouvements,
  PaiementHistorique,
  PretVuPartie,
  ResultatEnqueteItem,
  ResumeManchePublique,
  RevelationPublique,
} from './evenements-objets.ts';

export { TYPES_EVENEMENT } from './evenements-types.ts';
export type { TypeEvenement } from './evenements-types.ts';
export * from './evenements-objets.ts';

// --- Charges, une par événement ----------------------------------------------

export interface ChargeAccuseReception {
  readonly id_correlation: string;
  readonly type_commande: string;
  readonly accepte: true;
}

export interface ChargeErreur {
  readonly code: CodeErreur;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>> | null;
  readonly id_correlation: string | null;
}

export interface MoiPrive {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly position_cercle: number | null;
  readonly est_hote: boolean;
  readonly solde_pieces: number;
  readonly role_secret: Role | null;
  readonly mission_secrete: Mission | null;
  readonly clause_connue: Clause | null;
  readonly montant_declare: number | null;
  readonly montant_paye: number | null;
  readonly a_accuse_cette_manche: boolean;
  readonly mes_enquetes_de_la_manche: readonly ResultatEnqueteItem[];
  readonly mes_prets: readonly PretVuPartie[];
  readonly ma_signature_dernier_voeu: boolean | null;
}

export interface SessionPublique {
  readonly session_id: string;
  readonly code_adhesion: string;
  readonly etat_partie: EtatPartie;
  readonly mode_avance_actif: boolean;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface ChargeEtatCompletPrive {
  readonly session: SessionPublique;
  readonly moi: MoiPrive;
  readonly joueurs: readonly JoueurPublic[];
  readonly manche_courante: ResumeManchePublique | null;
  readonly phase: Phase | null;
  readonly phase_fin_at: string | null;
  readonly historique_manches: readonly ResumeManchePublique[];
  readonly mes_mouvements: PageMouvements;
  readonly groupe: EtatGroupe | null;
}

export interface ChargeEtatPartieChange {
  readonly etat_partie: EtatPartie;
  readonly manche_courante: number | null;
}

export interface ChargeJoueurRejoint {
  readonly joueur: JoueurPublic;
  readonly nb_joueurs: number;
}

export interface ChargePresence {
  readonly joueur_id: string;
  readonly nb_connectes: number;
}

export interface ChargeJoueurPretChange {
  readonly joueur_id: string;
  readonly pret: boolean;
}

export interface ChargePartieDemarree {
  readonly ordre_cercle: readonly string[];
  readonly nb_joueurs: number;
  readonly mode_avance_actif: boolean;
}

export interface ChargeAttributionPrivee {
  readonly role_secret: Role;
  readonly mission_secrete: Mission | null;
  readonly solde_initial: number;
}

export interface ChargeVoeuAnnonce {
  readonly numero_manche: number;
  readonly objectif: number;
  readonly nb_manches: number;
}

export interface ChargeClauseRecue {
  readonly clause: Clause;
  readonly numero_manche: number;
  readonly je_suis_porteur: boolean;
}

export interface ChargePhaseChangee {
  readonly phase: Phase;
  readonly phase_fin_at: string;
  readonly numero_manche: number;
  readonly actions_autorisees: readonly string[];
}

export interface ChargeDeclarationPubliee {
  readonly joueur_id: string;
  readonly montant_declare: number;
  readonly nb_declarations: number;
  readonly nb_joueurs: number;
}

export interface ChargePaiementEnregistre {
  readonly numero_manche: number;
  readonly enregistre: true;
}

/** Public, sans montant : voir l'annulation de CONF-12 (charges-neutres.ts). */
export interface ChargeJoueurOffrandeScellee {
  readonly joueur_id: string;
}

export interface ChargeTransfertEnregistre {
  readonly emetteur_joueur_id: string;
  readonly destinataire_joueur_id: string;
  readonly montant: number;
}

export interface ChargePretPropose {
  readonly pret: PretVuPartie;
}

export interface ChargePretResolu {
  readonly pret: PretVuPartie;
  readonly accepte: boolean;
}

export interface ChargePretPreleve {
  readonly pret: PretVuPartie;
  readonly montant_preleve: number;
  readonly reliquat_du: number;
}

export interface ChargeRevelationEcartTotal {
  readonly numero_manche: number;
  readonly total_declare: number;
  readonly total_paye: number;
  readonly objectif: number;
}

export interface ChargeRevelation {
  readonly numero_manche: number;
  readonly revelation: RevelationPublique;
  readonly suspects_restants: number;
}

export interface ChargeResultatEnquete {
  readonly cible_joueur_id: string;
  readonly montant_paye: number;
  readonly montant_declare: number;
  readonly cout_paye: number;
  readonly numero_manche: number;
}

export interface ChargeAccusationDeclaree {
  readonly accusation_id: string;
  readonly accusateur_joueur_id: string;
  readonly accuse_joueur_id: string;
  readonly numero_manche: number;
}

export interface ChargeAccusationResolue {
  readonly accusation_id: string;
  readonly verdict: Verdict;
  readonly liquidation_differee: true;
}

export interface ChargeExecutionResultat {
  readonly numero_manche: number;
  readonly reussi: boolean;
  readonly total_declare: number;
  readonly total_paye: number;
  readonly objectif: number;
  readonly recompense: number;
  readonly multiplicateur_applique: number;
  readonly clause_revelee: Clause;
  readonly effet_clause: string;
  readonly consolation_appliquee: boolean;
  readonly amendes_liquidees: readonly AmendeLiquidee[];
}

export interface ChargeSoldeMisAJour {
  readonly solde_pieces: number;
  readonly derniers_mouvements: PageMouvements;
}

export interface ChargeDernierVoeuPropose {
  readonly montant_propose: number;
  readonly phase_fin_at: string;
}

export type ConsequenceDernierVoeu =
  | 'AUCUN_SIGNATAIRE'
  | 'SIGNATAIRE_UNIQUE_RECOMPENSE'
  | 'CONTRAT_CONTESTE';

export interface ChargeDernierVoeuResolu {
  readonly nb_signataires: number;
  readonly consequence: ConsequenceDernierVoeu;
  readonly genie_libere: boolean;
}

export interface ChargeScoresFinaux {
  readonly classement: readonly LigneClassement[];
  readonly vainqueurs: readonly string[];
  readonly victoire_par_liberation: boolean;
  readonly genie_libere: boolean;
  readonly paiements_historiques: readonly PaiementHistorique[];
}

export type MotifAbandon = 'ABANDON_HOTE' | 'INACTIVITE_DEPASSEE';

export interface ChargePartieAbandonnee {
  /**
   * HOMONYME DÉCLARÉ (ARCHI registre_champs_secrets.homonymes_declares, liste
   * FERMÉE à une entrée) : EvtPartieAbandonnee.motif est PUBLIC, alors que
   * MouvementPiece.motif est strictement privé (CA-36). Toute décision de
   * confidentialité se prend sur le couple qualifié, jamais sur le nom nu.
   */
  readonly motif: MotifAbandon;
  readonly compteur_groupe_incremente: false;
}

export interface ChargeGroupeMisAJour {
  readonly groupe: EtatGroupe;
}

/** Correspondance type d'événement → type de sa charge. */
export interface ChargesParEvenement {
  readonly accuse_reception: ChargeAccuseReception;
  readonly erreur: ChargeErreur;
  readonly etat_complet_prive: ChargeEtatCompletPrive;
  readonly etat_partie_change: ChargeEtatPartieChange;
  readonly joueur_rejoint: ChargeJoueurRejoint;
  readonly joueur_quitte: ChargePresence;
  readonly joueur_reconnecte: ChargePresence;
  readonly joueur_pret_change: ChargeJoueurPretChange;
  readonly partie_demarree: ChargePartieDemarree;
  readonly attribution_privee: ChargeAttributionPrivee;
  readonly voeu_annonce: ChargeVoeuAnnonce;
  readonly clause_recue: ChargeClauseRecue;
  readonly phase_changee: ChargePhaseChangee;
  readonly declaration_publiee: ChargeDeclarationPubliee;
  readonly paiement_enregistre: ChargePaiementEnregistre;
  readonly joueur_offrande_scellee: ChargeJoueurOffrandeScellee;
  readonly transfert_enregistre: ChargeTransfertEnregistre;
  readonly pret_propose: ChargePretPropose;
  readonly pret_resolu: ChargePretResolu;
  readonly pret_preleve: ChargePretPreleve;
  readonly revelation_ecart_total: ChargeRevelationEcartTotal;
  readonly revelation: ChargeRevelation;
  readonly resultat_enquete: ChargeResultatEnquete;
  readonly accusation_declaree: ChargeAccusationDeclaree;
  readonly accusation_resolue: ChargeAccusationResolue;
  readonly execution_resultat: ChargeExecutionResultat;
  readonly solde_mis_a_jour: ChargeSoldeMisAJour;
  readonly dernier_voeu_propose: ChargeDernierVoeuPropose;
  readonly dernier_voeu_resolu: ChargeDernierVoeuResolu;
  readonly scores_finaux: ChargeScoresFinaux;
  readonly partie_abandonnee: ChargePartieAbandonnee;
  readonly groupe_mis_a_jour: ChargeGroupeMisAJour;
}
