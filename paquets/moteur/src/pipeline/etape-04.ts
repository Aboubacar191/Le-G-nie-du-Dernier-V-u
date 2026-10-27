// Étape 4 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[3] :
//   multiplicateur = multiplicateur_recompense ;
//   si clause TRESOR_DES_HONNETES active ET |menteurs| == 0 alors multiplicateur = multiplicateur_recompense_tresor_honnetes.
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape04 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
