// Étape 7 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[6] :
//   exclus_du_partage = { joueurs démasqués durant la manche, c.-à-d.
//   accusés avec verdict MENTEUR }.
//
// Condition : reussi
//
// RG-15 : un joueur démasqué perd sa part de récompense de CETTE manche. Il
// n'est pas éliminé et conserve tous ses droits (RG-46).

import { manchePipeline, type ContexteExecution } from './contexte.ts';

export function etape07(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  const manche = manchePipeline(contexte);
  const exclus = [
    ...new Set(
      manche.accusations
        .filter((accusation) => accusation.verdict === 'MENTEUR')
        .map((accusation) => accusation.accuse_joueur_id),
    ),
  ];
  return { ...contexte, exclus };
}

export type Etape07 = typeof etape07;
