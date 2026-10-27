// Corrélation et idempotence (RG-70).
//
// Le serveur mémorise les 32 derniers couples (joueur_id, id_correlation) et
// leur réponse. Une commande rejouée avec le même id_correlation reçoit la
// réponse mémorisée, sans réappliquer l'effet : une perte réseau ne doit pas
// coûter une double déclaration.
//
// NOTE DE NOMMAGE : le nom de ce fichier est accentué parce que l'arborescence
// normative de l'ARCHI l'écrit ainsi (« src/temps-reel/corrélation.ts »).
// L'écart avec le kebab-case ASCII habituel est volontaire et déclaré, pas subi.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export const TAILLE_CACHE_CORRELATION = 32;

export interface CacheCorrelation {
  reponseMemorisee(joueurId: string, idCorrelation: string): unknown | undefined;
  memoriser(joueurId: string, idCorrelation: string, reponse: unknown): void;
}
