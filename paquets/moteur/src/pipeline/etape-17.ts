// Étape 17 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[16] :
//   clôture de la manche ; écriture de tous les MouvementPieces correspondants.
//
// Les mouvements ont été écrits à l'étape QUI LES PRODUIT (9, 10, 11, 13, 14,
// 15), parce que le plafonnement des étapes 13 à 15 se calcule sur le solde
// courant : tout repousser ici changerait les montants liquidés, ce que RG-40
// interdit. Cette étape fige donc le résultat de la manche et notifie chaque
// joueur de son nouveau solde, par un message privé (CA-36).
//
// RUP-02 / RG-80 : la notification part pour les N joueurs de la session, et
// non plus pour les seuls joueurs TOUCHÉS. L'ensemble des joueurs touchés dépend
// directement d'actes secrets — qui a payé combien, qui a reçu une part, qui a
// été consolé, qui a été amendé — si bien que le NOMBRE de trames émises à la
// clôture mesurait l'ampleur des mouvements de la manche. Deux parties à graine
// identique ne différant que par le montant payé par un joueur produisaient un
// nombre de trames différent : c'est exactement le contrôle U2 de la porte
// d'uniformité, et le contexte.joueurs_touches en était la cause.
//
// joueurs_touches n'est PAS supprimé pour autant : il reste la trace de ce que
// la manche a déplacé, et il est consommé par les tests du pipeline. Ce qui
// cesse, c'est son usage comme liste de DESTINATAIRES.
//
// L'ordre d'émission est celui de etat.joueurs, qui est l'ordre du cercle, donc
// public. Un ordre dérivé de joueurs_touches aurait livré par sa seule
// permutation l'ordre dans lequel les soldes ont bougé.

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

  const soldes: Effet[] = contexte.etat.joueurs.map((joueur) => ({
    type: 'solde_mis_a_jour',
    joueur_id: joueur.id,
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
