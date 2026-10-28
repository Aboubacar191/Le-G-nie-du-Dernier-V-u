// Étape 11 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[10] :
//
//   si NON reussi ET clause CONSOLATION active : chaque joueur reçoit
//   plancher(montant_paye_i / 2).
//
// Condition : echec
//
// RG-74 : les montants de consolation INDIVIDUELS ne sont jamais publiés —
// plancher(montant_paye_i / 2) est une fonction directe du paiement secret.
// Seuls l'activation de la clause et le TOTAL consolé sortent ; chacun apprend
// sa part par EvtSoldeMisAJour, qui est privé.

import { payeDe } from '../etat/acces.ts';
import { appliquerMouvements } from '../etat/mouvements.ts';
import { plancher, somme } from '../monnaie/index.ts';
import { clauseActive, manchePipeline, avecJoueursTouches, type ContexteExecution } from './contexte.ts';

export function etape11(contexte: ContexteExecution): ContexteExecution {
  if (contexte.reussi) return contexte;
  if (!clauseActive(contexte, 'CONSOLATION')) return contexte;
  const manche = manchePipeline(contexte);
  const fraction = contexte.etat.config.fraction_consolation;

  const montants = contexte.etat.joueurs.map((joueur) => ({
    joueur_id: joueur.id,
    montant: plancher(payeDe(manche, joueur.id), fraction),
  }));
  const verses = montants.filter((ligne) => ligne.montant > 0);

  const etat = appliquerMouvements(
    contexte.etat,
    verses.map((ligne) => ({
      joueur_id: ligne.joueur_id,
      delta: ligne.montant,
      motif: 'consolation' as const,
      manche_numero: contexte.numero,
    })),
    contexte.ecriture,
  );

  const suite = avecJoueursTouches(contexte, etat, verses.map((ligne) => ligne.joueur_id));
  return {
    ...suite,
    consolation_appliquee: true,
    total_consolation: somme(montants.map((ligne) => ligne.montant)),
  };
}

export type Etape11 = typeof etape11;
