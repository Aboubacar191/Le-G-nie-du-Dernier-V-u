// Étape 6 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[5] :
//
//   si clause GENIE_GARDE_UN_TIERS active alors
//   recompense = plancher(recompense * 2 / 3).
//
// Condition : reussi
//
// La fraction 2/3 n'est pas écrite ici : elle est le COMPLÉMENT de
// fraction_retenue_genie, lue dans la configuration ([1,3] par défaut). Le
// génie garde un tiers, la table se partage le reste. L'arrondi est un plancher
// explicite, jamais implicite (ADR-TL-14).

import { complement, plancher } from '../monnaie/index.ts';
import { clauseActive, type ContexteExecution } from './contexte.ts';

export function etape06(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  if (!clauseActive(contexte, 'GENIE_GARDE_UN_TIERS')) return contexte;
  const restant = complement(contexte.etat.config.fraction_retenue_genie);
  return { ...contexte, recompense: plancher(contexte.recompense, restant) };
}

export type Etape06 = typeof etape06;
