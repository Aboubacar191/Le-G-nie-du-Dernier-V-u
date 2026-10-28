// Liquidation d'une accusation — mécanique commune aux étapes 13 et 14.
//
// Les deux étapes restent DISTINCTES et dans leur ordre normatif : l'une liquide
// les amendes de verdict MENTEUR, l'autre les pénalités de verdict HONNETE, et
// RG-40 interdit de les confondre. Seul le GESTE est commun — plafonner au solde
// du débiteur, transférer, journaliser — et il est écrit une fois : deux copies
// d'un plafonnement, c'est une qui sera corrigée seule.

import type { MotifMouvement } from '@gdv/partage';

import { exigerJoueur } from '../etat/acces.ts';
import { transferer } from '../etat/mouvements.ts';
import { plafonnerAuSolde } from '../monnaie/index.ts';
import type { Accusation } from '../etat/types.ts';
import {
  avecJoueursTouches,
  type AmendeLiquideeInterne,
  type ContexteExecution,
} from './contexte.ts';

export interface DemandeLiquidation {
  readonly accusation: Accusation;
  readonly montant_du: number;
  readonly debiteur: string;
  readonly crediteur: string;
  readonly motif_debit: MotifMouvement;
  readonly motif_credit: MotifMouvement;
}

export interface Liquidation {
  readonly contexte: ContexteExecution;
  readonly amende: AmendeLiquideeInterne;
  readonly accusation: Accusation;
}

/**
 * Prélèvement INVOLONTAIRE : plafonné au solde du débiteur, jamais refusé
 * (RG-41). Le reliquat est abandonné et non reporté — c'est explicitement ce que
 * demande l'étape 13 pour les amendes.
 */
export function liquider(
  contexte: ContexteExecution,
  demande: DemandeLiquidation,
): Liquidation {
  const solde = exigerJoueur(contexte.etat, demande.debiteur).solde_pieces;
  const liquide = plafonnerAuSolde(demande.montant_du, solde);
  const etat = transferer(
    contexte.etat,
    {
      de: demande.debiteur,
      vers: demande.crediteur,
      montant: liquide,
      motif_debit: demande.motif_debit,
      motif_credit: demande.motif_credit,
      manche_numero: contexte.numero,
    },
    contexte.ecriture,
  );
  return {
    contexte: avecJoueursTouches(contexte, etat, [demande.debiteur, demande.crediteur]),
    amende: {
      accusation_id: demande.accusation.id,
      debiteur_joueur_id: demande.debiteur,
      crediteur_joueur_id: demande.crediteur,
      montant_liquide: liquide,
      montant_du: demande.montant_du,
    },
    accusation: {
      ...demande.accusation,
      montant_amende_du: demande.montant_du,
      montant_amende_liquide: liquide,
      liquide_at: contexte.ecriture.maintenant,
    },
  };
}

/** Réécrit les accusations de la manche courante du pipeline. */
export function avecAccusations(
  contexte: ContexteExecution,
  accusations: readonly Accusation[],
): ContexteExecution {
  return {
    ...contexte,
    etat: {
      ...contexte.etat,
      manches: contexte.etat.manches.map((manche) =>
        manche.numero === contexte.numero ? { ...manche, accusations } : manche,
      ),
    },
  };
}
