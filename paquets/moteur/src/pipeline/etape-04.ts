// Étape 4 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[3] :
//   multiplicateur = multiplicateur_recompense ;
//   si clause TRESOR_DES_HONNETES active ET |menteurs| == 0 alors
//   multiplicateur = multiplicateur_recompense_tresor_honnetes.
//
// Condition : reussi
//
// Les deux multiplicateurs sont lus dans la configuration (RG-60) : aucune
// valeur d'équilibrage n'apparaît ici en littéral.

import { clauseActive, type ContexteExecution } from './contexte.ts';

export function etape04(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  const config = contexte.etat.config;
  const tresor = clauseActive(contexte, 'TRESOR_DES_HONNETES') && contexte.menteurs.length === 0;
  return {
    ...contexte,
    multiplicateur: tresor
      ? config.multiplicateur_recompense_tresor_honnetes
      : config.multiplicateur_recompense,
  };
}

export type Etape04 = typeof etape04;
