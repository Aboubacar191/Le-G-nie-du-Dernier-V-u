// Étape 3 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[2] :
//   reussi = (total_paye >= objectif).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape03 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
