// Étape 14 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[13] :
//
//   pour chaque accusation de verdict HONNETE : penalite =
//   cout_fausse_accusation * facteur_amende, transférée de l'accusateur vers
//   l'accusé, plafonnée au solde de l'accusateur.
//
// RG-44 : la clause PRIME_AU_DELATEUR double aussi cette pénalité, considérée
// comme une amende de la manche. Le cas limite « pénalité supérieure au solde
// de l'accusateur » est plafonné, jamais refusé.

import type { Accusation } from '../etat/types.ts';
import { manchePipeline, type AmendeLiquideeInterne, type ContexteExecution } from './contexte.ts';
import { avecAccusations, liquider } from './liquidation.ts';

export function etape14(contexte: ContexteExecution): ContexteExecution {
  let courant = contexte;
  const amendes: AmendeLiquideeInterne[] = [...contexte.amendes];
  const resolues: Accusation[] = [];

  for (const accusation of manchePipeline(contexte).accusations) {
    if (accusation.verdict !== 'HONNETE') {
      resolues.push(accusation);
      continue;
    }
    const liquidation = liquider(courant, {
      accusation,
      montant_du: contexte.etat.config.cout_fausse_accusation * courant.facteur_amende,
      debiteur: accusation.accusateur_joueur_id,
      crediteur: accusation.accuse_joueur_id,
      motif_debit: 'penalite_fausse_accusation_payee',
      motif_credit: 'penalite_fausse_accusation_recue',
    });
    courant = liquidation.contexte;
    amendes.push(liquidation.amende);
    resolues.push(liquidation.accusation);
  }

  return { ...avecAccusations(courant, resolues), amendes };
}

export type Etape14 = typeof etape14;
