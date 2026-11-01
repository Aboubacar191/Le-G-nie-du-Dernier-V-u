// Énumération FERMÉE des codes d'erreur (ARCHI standards.codes_erreur).
// Une seule forme d'erreur pour toute la frontière : REST (corps de toute
// réponse 4xx/5xx) et temps réel (événement de type erreur).
// Transcrite depuis ARCHI-GDV-001.json — aucun code ajouté.
//
// ÉCART DE CONTRAT SIGNALÉ, pas tranché ici. PRET_INDISPONIBLE est ajouté par
// API-GDV-001.json 1.1.0 / x-temps-reel.codes_erreur pour fermer ANO-08 et
// ANO-09, et il est NORMATIF côté protocole. Il est en revanche ABSENT de
// ARCHI-GDV-001.json 1.2.0 / standards.codes_erreur, qui n'énumère que 24
// codes. Les deux contrats ne s'accordent pas. Le code suit l'API, qui est la
// source de vérité du PROTOCOLE et la seule qui décrive le couple code/message
// à rendre ; l'écart est consigné dans RAPPORT-BACKEND-002.json pour que le
// tech-lead aligne l'ARCHI. Sans ce code, le correctif de ANO-08 serait
// impossible à exprimer.

export const CODES_ERREUR = [
  'ACTION_HORS_PHASE',
  'ACTION_NON_AUTORISEE_ROLE',
  'ACTION_RESERVEE_HOTE',
  'SOLDE_INSUFFISANT',
  'PRET_INDISPONIBLE',
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
