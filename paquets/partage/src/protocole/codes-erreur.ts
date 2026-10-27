// Énumération FERMÉE des codes d'erreur (ARCHI standards.codes_erreur).
// Une seule forme d'erreur pour toute la frontière : REST (corps de toute
// réponse 4xx/5xx) et temps réel (événement de type erreur).
// Transcrite depuis ARCHI-GDV-001.json — aucun code ajouté.

export const CODES_ERREUR = [
  'ACTION_HORS_PHASE',
  'ACTION_NON_AUTORISEE_ROLE',
  'ACTION_RESERVEE_HOTE',
  'SOLDE_INSUFFISANT',
  'QUOTA_DEPASSE',
  'JETON_INVALIDE',
  'JETON_ABSENT',
  'USURPATION_IDENTITE',
  'SESSION_PLEINE',
  'EFFECTIF_INSUFFISANT',
  'SESSION_INTROUVABLE',
  'CODE_ADHESION_INVALIDE',
  'ORDRE_PLACES_INVALIDE',
  'CIBLE_INVALIDE',
  'MONTANT_INVALIDE',
  'DECLARATION_REQUISE',
  'DEJA_SOUMIS',
  'PSEUDO_INDISPONIBLE',
  'MODE_AVANCE_INACTIF',
  'ETAT_PARTIE_INCOMPATIBLE',
  'MESSAGE_MALFORME',
  'COMMANDE_INCONNUE',
  'TROP_DE_REQUETES',
  'ERREUR_INTERNE',
] as const;

export type CodeErreur = (typeof CODES_ERREUR)[number];

/**
 * Enveloppe d'erreur, forme unique (ARCHI standards.enveloppe_erreur).
 * `message` est destiné à l'affichage et ne contient AUCUNE donnée secrète ;
 * `details` n'en contient jamais non plus.
 */
export interface Erreur {
  readonly code: CodeErreur;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly id_correlation?: string;
}
