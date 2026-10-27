// Rédacteur de journaux applicatifs (ARCHI standards.journalisation).
//
// Supprime toute clé listée dans CHAMPS_SECRETS du paquet partagé AVANT toute
// écriture de log. Aucun jeton, aucun montant payé, aucun rôle, aucune mission,
// aucune clause, aucune graine d'aléa ne peut apparaître dans un log, à aucun
// niveau, y compris en mode débogage.
//
// C'est le seul endroit du produit où la SUR-suppression est souhaitable :
// un champ public expurgé d'un log ne coûte rien, un jeton laissé dans un log
// coûte la partie.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import { CHAMPS_SECRETS } from '@gdv/partage';

export const CLES_SUPPRIMEES: readonly string[] = CHAMPS_SECRETS;

export type Rediger = (entree: unknown) => unknown;
