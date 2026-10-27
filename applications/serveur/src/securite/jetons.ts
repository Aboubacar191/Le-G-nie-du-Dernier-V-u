// Jetons de session et de groupe (ADR-TL-15).
//
// 32 octets tirés par crypto.randomBytes, transmis en base64url, stockés
// HACHÉS en SHA-256. Une lecture du fichier de base ou d'une sauvegarde ne
// permet aucune usurpation. Comparaison à temps constant sur les condensats.
//
// Le jeton en clair n'est émis qu'UNE fois, vers son seul propriétaire, et
// n'est jamais rejoué ni journalisé.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export const OCTETS_JETON = 32;

export type GenererJeton = () => { clair: string; condensatHex: string };
export type HacherJeton = (jetonClair: string) => string;
export type ComparerCondensats = (attendu: string, presente: string) => boolean;
