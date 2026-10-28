// Étape 16 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[15] :
//
//   publication publique : reussi/echoue, total_declare, total_paye, objectif,
//   recompense, multiplicateur appliqué, parts par joueur, reliquat non
//   distribué, clause révélée et son effet, verdicts d'accusation et amendes
//   liquidées.
//   DEUX RESTRICTIONS (RG-74) : les montants de consolation INDIVIDUELS ne sont
//   jamais publiés, et l'identité du porteur de la clause ne l'est jamais non
//   plus.
//
// L'étape ne fabrique PAS de message : elle décide un effet. La charge est
// construite par la projection, qui n'ajoute que ce que le contrat déclare —
// c'est là, et nulle part ici, que les deux restrictions sont mécaniquement
// tenues (ADR-TL-09).

import type { Effet } from '../etat/effets.ts';
import type { ContexteExecution } from './contexte.ts';

export function etape16(contexte: ContexteExecution): ContexteExecution {
  const effet: Effet = { type: 'execution_resultat', numero_manche: contexte.numero };
  return { ...contexte, effets: [...contexte.effets, effet] };
}

export type Etape16 = typeof etape16;
