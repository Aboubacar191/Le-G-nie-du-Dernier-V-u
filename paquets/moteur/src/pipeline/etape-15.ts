// Étape 15 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
//
// RG-29, RÈGLE MODIFIÉE par la SPEC 1.4.1 — TOUT OU RIEN :
//
//   « Le remboursement vaut plafond(principal × (1 + taux_interet_pret)) et est
//     prélevé automatiquement à l'exécution de la manche suivante, EN TOTALITÉ
//     OU PAS DU TOUT : si le solde de l'emprunteur couvre la somme due, elle est
//     prélevée intégralement ; sinon rien n'est prélevé et la dette est reportée
//     entière à l'exécution suivante. AUCUN PRÉLÈVEMENT PARTIEL. Le prêteur
//     n'apprend qu'un booléen : remboursé, ou reporté. »
//
// POURQUOI LE PARTIEL A ÉTÉ SUPPRIMÉ. Il était un ORACLE DE SOLDE EXACT, mesuré
// par le QA (ANO-07, majeure) : dès que le reliquat dû était non nul, le montant
// prélevé ÉTAIT, par construction, le solde de l'emprunteur — prélevé 3, solde
// réel 3. Aucune réduction de charge ne pouvait fermer ce canal, puisque le
// prêteur voit le crédit dans son PROPRE journal de pièces, que RG-42 rend non
// supprimable. La fuite n'était pas dans le protocole mais dans la RÈGLE : c'est
// donc la règle qui change. Le résidu assumé est une inégalité d'UN SEUL BIT —
// le solde couvrait, ou non — inhérente à tout remboursement automatique.
//
// ÉCART DE CONTRAT SIGNALÉ, NON CORRIGÉ : SPEC-GDV-001.json /
// pipeline_execution.etapes[14] porte encore l'ancien énoncé (« prélèvement
// plafonné au solde de l'emprunteur, le reliquat reste dû »), que RG-29 1.4.1
// contredit mot pour mot. RG-29 prime — elle est datée, motivée par l'audit, et
// elle invalide nommément CA-34 — mais les deux textes devront être alignés par
// le chef de projet. Même remarque pour EvtPretPreleve.x-justification-visibilite
// de l'API, qui énonce encore « le prélèvement est plafonné au solde ».
//
// L'ÉCHÉANCE est inchangée : la condition est manche_emission < numero, et non
// manche_emission == numero − 1, sans quoi une dette reportée ne serait jamais
// reprise. Le taux est lu dans la configuration en rationnel [1,2] (ADR-TL-14).

import { exigerJoueur } from '../etat/acces.ts';
import { transferer } from '../etat/mouvements.ts';
import { plafond, unPlus } from '../monnaie/index.ts';
import type { Pret } from '../etat/types.ts';
import { avecJoueursTouches, type ContexteExecution } from './contexte.ts';
import type { Effet } from '../etat/effets.ts';

/** Rien n'est prélevé : la valeur est écrite, pas déduite d'un calcul. */
const RIEN = 0;

function echu(pret: Pret, numero: number): boolean {
  return pret.statut === 'ACTIF' && pret.manche_emission < numero && pret.rembourse < pret.du_total;
}

interface Prelevement {
  readonly contexte: ContexteExecution;
  readonly pret: Pret;
  readonly effet: Effet;
}

/**
 * Prélève, ou ne prélève pas. Les deux branches émettent un effet
 * `pret_preleve` : l'émettre dans le seul cas du succès ferait de son ABSENCE
 * l'information « le solde ne couvrait pas », livrée par simple dénombrement à
 * toute la table au lieu des deux parties (RG-80). Le prêteur lit le booléen
 * dans `statut` — SOLDE ou ACTIF — et sa charge ne porte rien d'autre.
 */
function prelever(contexte: ContexteExecution, pret: Pret): Prelevement {
  const duTotal = plafond(pret.principal, unPlus(contexte.etat.config.taux_interet_pret));
  const reste = duTotal - pret.rembourse;
  const solde = exigerJoueur(contexte.etat, pret.emprunteur_joueur_id).solde_pieces;

  if (solde < reste) {
    const reporte: Pret = { ...pret, du_total: duTotal };
    return {
      contexte,
      pret: reporte,
      effet: {
        type: 'pret_preleve',
        pret: reporte,
        montant_preleve: RIEN,
        reliquat_du: reste,
      },
    };
  }

  const etat = transferer(
    contexte.etat,
    {
      de: pret.emprunteur_joueur_id,
      vers: pret.preteur_joueur_id,
      montant: reste,
      motif_debit: 'remboursement_pret',
      motif_credit: 'remboursement_pret',
      manche_numero: contexte.numero,
    },
    contexte.ecriture,
  );
  const solde_: Pret = { ...pret, du_total: duTotal, rembourse: duTotal, statut: 'SOLDE' };
  return {
    contexte: avecJoueursTouches(contexte, etat, [
      pret.emprunteur_joueur_id,
      pret.preteur_joueur_id,
    ]),
    pret: solde_,
    effet: {
      type: 'pret_preleve',
      pret: solde_,
      montant_preleve: reste,
      reliquat_du: RIEN,
    },
  };
}

export function etape15(contexte: ContexteExecution): ContexteExecution {
  let courant = contexte;
  const effets: Effet[] = [...contexte.effets];
  const prets: Pret[] = [];

  for (const pret of contexte.etat.prets) {
    if (!echu(pret, contexte.numero)) {
      prets.push(pret);
      continue;
    }
    const prelevement = prelever(courant, pret);
    courant = prelevement.contexte;
    prets.push(prelevement.pret);
    effets.push(prelevement.effet);
  }

  return { ...courant, effets, etat: { ...courant.etat, prets } };
}

export type Etape15 = typeof etape15;
