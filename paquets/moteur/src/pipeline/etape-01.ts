// Étape 1 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[0] :
//   total_paye = somme des montant_paye de la manche ;
//   total_declare = somme des montant_declare.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape01 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
