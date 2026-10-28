// Étape 2 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[1] :
//   menteurs = { joueurs tels que montant_declare - montant_paye > 0 } ;
//   ampleur_i = montant_declare_i - montant_paye_i.
//
// L'ampleur n'est JAMAIS émise comme champ, à aucun moment, pas même aux scores
// (RG-75). Elle vit ici et dans accusations.ampleur_mensonge, et nulle part sur
// le fil.

import { declareDe, payeDe } from '../etat/acces.ts';
import { manchePipeline, type ContexteExecution } from './contexte.ts';

export function etape02(contexte: ContexteExecution): ContexteExecution {
  const manche = manchePipeline(contexte);
  const ampleurs = new Map<string, number>();
  const menteurs: string[] = [];
  for (const joueur of contexte.etat.joueurs) {
    const ampleur = declareDe(manche, joueur.id) - payeDe(manche, joueur.id);
    ampleurs.set(joueur.id, ampleur);
    if (ampleur > 0) menteurs.push(joueur.id);
  }
  return { ...contexte, menteurs, ampleurs };
}

export type Etape02 = typeof etape02;
