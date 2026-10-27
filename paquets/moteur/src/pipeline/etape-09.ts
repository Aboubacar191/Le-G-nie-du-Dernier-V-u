// Étape 9 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[8] :
//   part_i = plancher(recompense * poids_i / somme(poids)) ;
//   si somme(poids) == 0 alors aucune part n'est versée.
//   Le reliquat de l'arrondi n'est PAS distribué (le génie le garde).
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape09 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
