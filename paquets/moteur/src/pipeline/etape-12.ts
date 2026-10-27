// Étape 12 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[11] :
//   facteur_amende = 1 ;
//   si clause PRIME_AU_DELATEUR active alors facteur_amende = 2.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape12 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
