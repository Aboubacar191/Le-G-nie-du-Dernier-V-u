// Interface du dépôt de persistance : abstraction du moteur de stockage.
//
// node:sqlite est un module jeune du runtime (dette assumée, ARCHI
// dette_assumee) : toute la persistance passe par cette interface pour que son
// remplacement coûte UN fichier d'implémentation, pas une réécriture.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export interface DepotSqlite {
  /** PRAGMA journal_mode=WAL et foreign_keys=ON appliqués à l'ouverture. */
  ouvrir(chemin: string): Promise<void>;
  fermer(): Promise<void>;
  /** Toute écriture d'effets et son entrée de journal dans UNE transaction. */
  enTransaction<T>(operation: () => T): T;
}
