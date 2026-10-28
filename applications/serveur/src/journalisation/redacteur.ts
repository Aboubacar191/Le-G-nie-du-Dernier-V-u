// Rédacteur de journaux applicatifs (ARCHI standards.journalisation).
//
// Supprime toute clé listée dans CHAMPS_SECRETS AVANT toute écriture de log.
// Aucun jeton, aucun montant payé, aucun rôle, aucune mission, aucune clause,
// aucune graine d'aléa ne peut apparaître dans un log, à aucun niveau, y
// compris en mode débogage.
//
// SEUL CONSOMMATEUR AUTORISÉ de l'union à plat CHAMPS_SECRETS (ADR-TL-18) :
// c'est le seul endroit du dépôt où la SUR-suppression joue en faveur de la
// sécurité. Expurger d'un log un joueur_id public ne coûte rien ; y laisser un
// jeton coûte une partie entière. Partout ailleurs — et en particulier dans la
// projection — la décision se prend sur le registre QUALIFIÉ par entité.

import { CHAMPS_SECRETS } from '@gdv/partage';

const REMPLACEMENT = '[expurge]';
const PROFONDEUR_MAX = 8;

export const CLES_SUPPRIMEES: readonly string[] = CHAMPS_SECRETS;

const INTERDITES: ReadonlySet<string> = new Set(CHAMPS_SECRETS);

/** Noms de clés à expurger même hors registre : ils portent des jetons en clair. */
const JETONS_EN_CLAIR: readonly string[] = [
  'jeton',
  'jeton_session',
  'jeton_groupe',
  'jeton_hote',
  'graine',
  'graine_alea',
  'charge_json',
  'authorization',
];

function doitExpurger(cle: string): boolean {
  const normalisee = cle.toLowerCase();
  return INTERDITES.has(cle) || JETONS_EN_CLAIR.includes(normalisee);
}

/**
 * Expurge récursivement. Au-delà de PROFONDEUR_MAX, la valeur est remplacée
 * plutôt que parcourue : un log n'a pas à suivre un graphe profond, et une
 * structure cyclique ne doit pas pouvoir bloquer l'écriture d'un journal.
 */
export function rediger(entree: unknown, profondeur = 0): unknown {
  if (profondeur > PROFONDEUR_MAX) return REMPLACEMENT;
  if (Array.isArray(entree)) {
    return entree.map((element) => rediger(element, profondeur + 1));
  }
  if (entree === null || typeof entree !== 'object') return entree;

  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(entree)) {
    sortie[cle] = doitExpurger(cle) ? REMPLACEMENT : rediger(valeur, profondeur + 1);
  }
  return sortie;
}

export type Rediger = typeof rediger;
