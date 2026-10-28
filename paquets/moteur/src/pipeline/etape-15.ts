// Étape 15 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[14] :
//
//   prélèvement des prêts échus (émis à la manche précédente) :
//   du_total = plafond(principal * (1 + taux_interet_pret)) ;
//   prélèvement plafonné au solde de l'emprunteur, le reliquat reste dû et sera
//   prélevé aux manches suivantes.
//
// RG-29 : « le reliquat reste dû et est prélevé aux exécutions suivantes ». Un
// prêt émis à la manche 2 et non soldé à la manche 3 est donc repris à la
// manche 4 : la condition d'échéance est manche_emission < numero, pas
// manche_emission == numero − 1, sans quoi un reliquat ne serait jamais repris.
// Le taux est lu dans la configuration en rationnel [1,2] (ADR-TL-14).

import { exigerJoueur } from '../etat/acces.ts';
import { transferer } from '../etat/mouvements.ts';
import { plafond, plafonnerAuSolde, unPlus } from '../monnaie/index.ts';
import type { Pret } from '../etat/types.ts';
import { avecJoueursTouches, type ContexteExecution } from './contexte.ts';
import type { Effet } from '../etat/effets.ts';

function echu(pret: Pret, numero: number): boolean {
  return pret.statut === 'ACTIF' && pret.manche_emission < numero && pret.rembourse < pret.du_total;
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
    const duTotal = plafond(pret.principal, unPlus(contexte.etat.config.taux_interet_pret));
    const reste = duTotal - pret.rembourse;
    const solde = exigerJoueur(courant.etat, pret.emprunteur_joueur_id).solde_pieces;
    const preleve = plafonnerAuSolde(reste, solde);

    const etat = transferer(
      courant.etat,
      {
        de: pret.emprunteur_joueur_id,
        vers: pret.preteur_joueur_id,
        montant: preleve,
        motif_debit: 'remboursement_pret',
        motif_credit: 'remboursement_pret',
        manche_numero: contexte.numero,
      },
      contexte.ecriture,
    );
    courant = avecJoueursTouches(courant, etat, [
      pret.emprunteur_joueur_id,
      pret.preteur_joueur_id,
    ]);

    const rembourse = pret.rembourse + preleve;
    const majour: Pret = {
      ...pret,
      du_total: duTotal,
      rembourse,
      statut: rembourse >= duTotal ? 'SOLDE' : 'ACTIF',
    };
    prets.push(majour);
    effets.push({
      type: 'pret_preleve',
      pret: majour,
      montant_preleve: preleve,
      reliquat_du: duTotal - rembourse,
    });
  }

  return { ...courant, effets, etat: { ...courant.etat, prets } };
}

export type Etape15 = typeof etape15;
