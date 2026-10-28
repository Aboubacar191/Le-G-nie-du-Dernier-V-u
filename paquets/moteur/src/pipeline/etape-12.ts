// Étape 12 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[11] :
//   facteur_amende = 1 ;
//   si clause PRIME_AU_DELATEUR active alors facteur_amende = 2.
//
// RG-44 : la clause double AUSSI la pénalité de fausse accusation, considérée
// comme une amende de la manche. Le facteur appartient à l'énoncé de la clause,
// il est nommé ici.

import { clauseActive, type ContexteExecution } from './contexte.ts';

const FACTEUR_PRIME_AU_DELATEUR = 2;

export function etape12(contexte: ContexteExecution): ContexteExecution {
  const prime = clauseActive(contexte, 'PRIME_AU_DELATEUR');
  return { ...contexte, facteur_amende: prime ? FACTEUR_PRIME_AU_DELATEUR : 1 };
}

export type Etape12 = typeof etape12;
