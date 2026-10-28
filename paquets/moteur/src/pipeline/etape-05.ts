// Étape 5 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[4] :
//   recompense = multiplicateur * total_paye.
//
// Condition : reussi

import type { ContexteExecution } from './contexte.ts';

export function etape05(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  return { ...contexte, recompense: contexte.multiplicateur * contexte.total_paye };
}

export type Etape05 = typeof etape05;
