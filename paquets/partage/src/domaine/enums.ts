// Énumérations du domaine. Clés IDENTIQUES en base, sur le fil et dans le code
// (ARCHI standards.casse_code : SCREAMING_SNAKE_CASE pour les clés métier).
// Transcrites depuis API-GDV-001.json / components.schemas — aucune valeur inventée.
// Aucune logique : des valeurs, et rien d'autre.

export const PHASE = [
  'VOEU',
  'NEGOCIATION',
  'DECLARATION_PAIEMENT',
  'REVELATION',
  'ENQUETES_ACCUSATIONS',
  'EXECUTION',
  'DV_PROPOSITION',
  'DV_DEBAT',
  'DV_SIGNATURE',
  'DV_RESOLUTION',
] as const;
export type Phase = (typeof PHASE)[number];

export const ETAT_PARTIE = [
  'CREEE',
  'SALLE_ATTENTE',
  'PLACEMENT',
  'DISTRIBUTION',
  'MANCHE_EN_COURS',
  'DERNIER_VOEU',
  'SCORES',
  'TERMINEE',
  'ABANDONNEE',
] as const;
export type EtatPartie = (typeof ETAT_PARTIE)[number];

export const ROLE = [
  'INSPECTEUR_TRESOR',
  'FAISEUR_CONTRATS',
  'PRETEUR',
  'MARCHAND_EPICES',
  'MARCHAND_DEJA_LIE',
] as const;
export type Role = (typeof ROLE)[number];

export const MISSION = [
  'LE_MAGNAT',
  'LE_FAUSSAIRE',
  'LE_JUSTICIER',
  'LE_BATISSEUR',
  'LE_SABOTEUR',
  'GARDIEN_DE_LA_LAMPE',
] as const;
export type Mission = (typeof MISSION)[number];

export const CLAUSE = [
  'GENIE_GARDE_UN_TIERS',
  'TRESOR_DES_HONNETES',
  'LE_PLUS_GENEREUX',
  'CONSOLATION',
  'PRIME_AU_DELATEUR',
] as const;
export type Clause = (typeof CLAUSE)[number];

export const GABARIT = ['ECART_TOTAL', 'COMPTAGE', 'VOISINAGE', 'EXONERATION', 'COMPARAISON', 'PASSE'] as const;
export type Gabarit = (typeof GABARIT)[number];

export const VERDICT = ['MENTEUR', 'HONNETE'] as const;
export type Verdict = (typeof VERDICT)[number];

export const STATUT_PRET = ['PROPOSE', 'REFUSE', 'ACTIF', 'SOLDE', 'EXPIRE'] as const;
export type StatutPret = (typeof STATUT_PRET)[number];

// snake_case : ces valeurs circulent sur le fil (ARCHI standards.casse_json).
export const MOTIF_MOUVEMENT = [
  'dotation_initiale',
  'paiement_voeu',
  'part_recompense',
  'bonus_epices',
  'amende_recue',
  'amende_payee',
  'penalite_fausse_accusation_payee',
  'penalite_fausse_accusation_recue',
  'cout_enquete',
  'transfert_emis',
  'transfert_recu',
  'pret_emis',
  'pret_recu',
  'remboursement_pret',
  'consolation',
  'signature_dernier_voeu',
  'sanction_contrat_conteste',
] as const;
export type MotifMouvement = (typeof MOTIF_MOUVEMENT)[number];
