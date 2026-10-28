// Étape 9 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[8] :
//   part_i = plancher(recompense * poids_i / somme(poids)) ;
//   si somme(poids) == 0 alors aucune part n'est versée.
//   Le reliquat de l'arrondi n'est PAS distribué (le génie le garde).
//
// Condition : reussi
//
// Les parts sont VERSÉES ici, et non repoussées à l'étape 17 : le plafonnement
// des étapes 13 à 15 se calcule sur le solde courant, donc l'ordre de mise en
// mouvement de l'argent fait partie de l'ordre normatif (RG-40). Repousser tous
// les mouvements à l'étape 17 changerait les résultats.

import { appliquerMouvements } from '../etat/mouvements.ts';
import { prorata, somme } from '../monnaie/index.ts';
import type { PartManche } from '../etat/types.ts';
import { avecJoueursTouches, type ContexteExecution } from './contexte.ts';

export function etape09(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  const exclus = new Set(contexte.exclus);
  const sommePoids = somme([...contexte.poids.values()]);

  const parts: PartManche[] = contexte.etat.joueurs.map((joueur) => ({
    joueur_id: joueur.id,
    part: prorata(contexte.recompense, contexte.poids.get(joueur.id) ?? 0, sommePoids),
    exclu_du_partage: exclus.has(joueur.id),
  }));

  const versees = parts.filter((part) => part.part > 0);
  const etat = appliquerMouvements(
    contexte.etat,
    versees.map((part) => ({
      joueur_id: part.joueur_id,
      delta: part.part,
      motif: 'part_recompense' as const,
      manche_numero: contexte.numero,
    })),
    contexte.ecriture,
  );

  const suite = avecJoueursTouches(
    contexte,
    etat,
    versees.map((part) => part.joueur_id),
  );
  return {
    ...suite,
    parts,
    reliquat_non_distribue: contexte.recompense - somme(parts.map((part) => part.part)),
  };
}

export type Etape09 = typeof etape09;
