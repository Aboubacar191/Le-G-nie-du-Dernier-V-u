// Étape 3 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[2] :
//   reussi = (total_paye >= objectif).
//
// RG-12 : l'égalité stricte est un SUCCÈS. Le cas limite « total payé égal
// exactement à l'objectif » est donc gagnant, et non perdant.

import { manchePipeline, type ContexteExecution } from './contexte.ts';

export function etape03(contexte: ContexteExecution): ContexteExecution {
  const manche = manchePipeline(contexte);
  return { ...contexte, reussi: contexte.total_paye >= manche.objectif };
}

export type Etape03 = typeof etape03;
