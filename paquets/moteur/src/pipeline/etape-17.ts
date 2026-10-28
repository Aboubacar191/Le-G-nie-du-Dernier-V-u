// Étape 17 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[16] :
//   clôture de la manche ; écriture de tous les MouvementPieces correspondants.
//
// Les mouvements ont été écrits à l'étape QUI LES PRODUIT (9, 10, 11, 13, 14,
// 15), parce que le plafonnement des étapes 13 à 15 se calcule sur le solde
// courant : tout repousser ici changerait les montants liquidés, ce que RG-40
// interdit. Cette étape fige donc le résultat de la manche et notifie chaque
// joueur TOUCHÉ de son nouveau solde, par un message privé (CA-36).

import type { Effet } from '../etat/effets.ts';
import type { Manche } from '../etat/types.ts';
import { manchePipeline, type ContexteExecution } from './contexte.ts';

export function etape17(contexte: ContexteExecution): ContexteExecution {
  const manche = manchePipeline(contexte);
  const clos: Manche = {
    ...manche,
    total_declare: contexte.total_declare,
    total_paye: contexte.total_paye,
    reussi: contexte.reussi,
    recompense: contexte.reussi ? contexte.recompense : 0,
    multiplicateur_applique: contexte.reussi ? contexte.multiplicateur : 0,
    facteur_amende: contexte.facteur_amende,
    parts: contexte.parts,
    reliquat_non_distribue: contexte.reliquat_non_distribue,
    consolation_appliquee: contexte.consolation_appliquee,
    total_consolation: contexte.total_consolation,
    bonus_epices_verse: contexte.bonus_epices_verse,
    cloture: true,
    cloture_at: contexte.ecriture.maintenant,
  };

  const soldes: Effet[] = [...contexte.joueurs_touches].map((joueur_id) => ({
    type: 'solde_mis_a_jour',
    joueur_id,
  }));

  return {
    ...contexte,
    etat: {
      ...contexte.etat,
      manches: contexte.etat.manches.map((m) => (m.numero === contexte.numero ? clos : m)),
    },
    effets: [...contexte.effets, ...soldes],
  };
}

export type Etape17 = typeof etape17;
