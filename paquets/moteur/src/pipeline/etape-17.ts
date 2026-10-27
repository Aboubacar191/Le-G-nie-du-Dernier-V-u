// Étape 17 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[16] :
//   clôture de la manche ; écriture de tous les MouvementPieces correspondants.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape17 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
