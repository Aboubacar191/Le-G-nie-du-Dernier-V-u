// Étape 8 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[7] :
//   poids_i = montant_declare_i pour tout joueur non exclu, 0 sinon ;
//   si clause LE_PLUS_GENEREUX active, poids_i *= 2 pour tout joueur non exclu appartenant à argmax(montant_paye).
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape08 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
