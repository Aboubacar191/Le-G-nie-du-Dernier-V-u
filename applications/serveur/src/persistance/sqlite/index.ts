// Implémentation node:sqlite du dépôt : mappeurs et transactions.
//
// Mesuré sur le poste (ARCHI stack._mesures_faites) : DatabaseSync fonctionnel,
// PRAGMA journal_mode=WAL accepté sur fichier, 2000 insertions
// transactionnelles en 189 ms, aucune compilation native sous Windows.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { DepotSqlite } from '../depot.ts';

export type CreerDepotSqlite = () => DepotSqlite;
