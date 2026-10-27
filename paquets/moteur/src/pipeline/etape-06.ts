// Étape 6 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[5] :
//   
//   si clause GENIE_GARDE_UN_TIERS active alors recompense = plancher(recompense * 2 / 3).
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape06 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
