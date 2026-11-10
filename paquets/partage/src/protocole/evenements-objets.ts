// =============================================================================
// OBJETS PARTAGÉS DES CHARGES D'ÉVÉNEMENT (API-GDV-001.json)
// =============================================================================
// Objets de charge communs à plusieurs événements, transcrits du contrat. Aucune charge n'est inventée :
// outils/verifier-visibilite.mjs et tests/contrat-evenements.test.ts échouent si
// l'énumération, les champs déclarés et les schémas divergent.
//
// Les charges sont des types EXACTS (aucune propriété optionnelle implicite) :
// la projection construit par AJOUT, et un champ qu'un type n'autorise pas ne
// peut pas être ajouté par inadvertance.

import type {
  Clause,
  Gabarit,
  Mission,
  MotifMouvement,
  Role,
  StatutPret,
  Verdict,
} from '../domaine/enums.ts';

// --- Objets partagés entre plusieurs messages --------------------------------

export interface JoueurPublic {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly position_cercle: number | null;
  readonly connecte: boolean;
  readonly est_hote: boolean;
  readonly pret: boolean;
  /** Scellement du paiement secret de la manche courante. Jamais de montant. */
  readonly offrande_scellee: boolean;
}

export interface MouvementPiece {
  readonly sequence: number;
  readonly manche_numero: number | null;
  readonly delta: number;
  readonly motif: MotifMouvement;
  readonly contrepartie_joueur_id: string | null;
  readonly solde_apres: number;
  readonly cree_at: string;
}

export interface PageMouvements {
  readonly elements: readonly MouvementPiece[];
  readonly curseur_suivant: string | null;
  readonly tronque: boolean;
}

export interface PretVuPartie {
  readonly pret_id: string;
  readonly preteur_joueur_id: string;
  readonly emprunteur_joueur_id: string;
  readonly principal: number;
  readonly du_total: number;
  readonly rembourse: number;
  readonly manche_emission: number;
  readonly statut: StatutPret;
}

export interface DeclarationPublique {
  readonly joueur_id: string;
  readonly montant_declare: number;
}

export interface AccusationPublique {
  readonly accusation_id: string;
  readonly accusateur_joueur_id: string;
  readonly accuse_joueur_id: string;
  readonly verdict: Verdict;
}

export interface AmendeLiquidee {
  readonly accusation_id: string;
  readonly debiteur_joueur_id: string;
  readonly crediteur_joueur_id: string;
  readonly montant_liquide: number;
  readonly montant_du: number;
}

export interface RevelationPublique {
  readonly gabarit: Gabarit;
  readonly variante_formulation: number;
  readonly cibles: readonly string[];
  readonly valeurs: Readonly<Record<string, number>>;
}

export interface ResumeManchePublique {
  readonly numero: number;
  readonly objectif: number;
  readonly cloture: boolean;
  readonly total_declare: number | null;
  readonly total_paye: number | null;
  readonly reussi: boolean | null;
  readonly recompense: number | null;
  readonly clause_revelee: Clause | null;
  readonly declarations: readonly DeclarationPublique[];
  readonly revelations: readonly RevelationPublique[];
  readonly accusations: readonly AccusationPublique[];
}

export interface ResultatEnqueteItem {
  readonly cible_joueur_id: string;
  readonly montant_paye: number;
  readonly manche_numero: number;
}

export interface EtatGroupe {
  readonly groupe_id: string;
  readonly parties_terminees: number;
  readonly dernier_voeu_debloque: boolean;
  readonly parties_requises: number;
}

export interface LigneClassement {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly pieces_restantes: number;
  readonly score_final: number;
  readonly role_secret: Role;
  readonly mission_secrete: Mission | null;
  readonly mission_reussie: boolean;
  readonly a_signe_dernier_voeu: boolean | null;
  readonly rang: number;
}

export interface PaiementHistorique {
  readonly numero_manche: number;
  readonly joueur_id: string;
  readonly montant_declare: number;
  readonly montant_paye: number;
}

