// Étape 1 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[0] :
//   total_paye = somme des montant_paye de la manche ;
//   total_declare = somme des montant_declare.
//
// La matérialisation de RG-32 est faite ICI, une fois pour toutes : une
// déclaration non soumise vaut 0, un paiement non soumis vaut 0.

import { declareDe, payeDe } from '../etat/acces.ts';
import { somme } from '../monnaie/index.ts';
import { manchePipeline, type ContexteExecution } from './contexte.ts';

export function etape01(contexte: ContexteExecution): ContexteExecution {
  const manche = manchePipeline(contexte);
  const identifiants = contexte.etat.joueurs.map((joueur) => joueur.id);
  return {
    ...contexte,
    total_declare: somme(identifiants.map((id) => declareDe(manche, id))),
    total_paye: somme(identifiants.map((id) => payeDe(manche, id))),
  };
}

export type Etape01 = typeof etape01;
