// Étape 7 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[6] :
//   exclus_du_partage = { joueurs démasqués durant la manche, c.-à-d.
//   accusés avec verdict MENTEUR }.
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape07 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
