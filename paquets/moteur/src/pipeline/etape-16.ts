// Étape 16 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[15] :
//
//   publication publique : reussi/echoue, total_declare, total_paye, objectif, recompense, multiplicateur appliqué, parts par joueur, reliquat non distribué, clause révélée et son effet, verdicts d'accusation et amendes liquidées.
//   DEUX RESTRICTIONS (RG-74) : les montants de consolation INDIVIDUELS ne sont jamais publiés, et l'identité du porteur de la clause ne l'est jamais non plus.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape16 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
