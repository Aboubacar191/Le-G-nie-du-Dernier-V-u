// Étape 13 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[12] :
//
//   pour chaque accusation de verdict MENTEUR : amende = multiplicateur_amende
//   * ampleur_mensonge * facteur_amende, transférée de l'accusé vers
//   l'accusateur, PLAFONNÉE au solde de l'accusé (le reliquat est abandonné,
//   pas reporté).
//
// CA-25 : ampleur 5, solde 3, amende due 10 => l'accusé tombe à 0, l'accusateur
// reçoit 3, aucun solde n'est négatif.

import type { Accusation } from '../etat/types.ts';
import { manchePipeline, type AmendeLiquideeInterne, type ContexteExecution } from './contexte.ts';
import { avecAccusations, liquider } from './liquidation.ts';

export function etape13(contexte: ContexteExecution): ContexteExecution {
  let courant = contexte;
  const amendes: AmendeLiquideeInterne[] = [...contexte.amendes];
  const resolues: Accusation[] = [];

  for (const accusation of manchePipeline(contexte).accusations) {
    if (accusation.verdict !== 'MENTEUR') {
      resolues.push(accusation);
      continue;
    }
    const ampleur = courant.ampleurs.get(accusation.accuse_joueur_id) ?? 0;
    const liquidation = liquider(courant, {
      accusation: { ...accusation, ampleur_mensonge: ampleur },
      montant_du: contexte.etat.config.multiplicateur_amende * ampleur * courant.facteur_amende,
      debiteur: accusation.accuse_joueur_id,
      crediteur: accusation.accusateur_joueur_id,
      motif_debit: 'amende_payee',
      motif_credit: 'amende_recue',
    });
    courant = liquidation.contexte;
    amendes.push(liquidation.amende);
    resolues.push(liquidation.accusation);
  }

  return { ...avecAccusations(courant, resolues), amendes };
}

export type Etape13 = typeof etape13;
