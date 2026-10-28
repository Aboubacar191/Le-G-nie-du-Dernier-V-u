// Accumulateur du pipeline d'exécution (RG-40).
//
// Les 17 étapes sont des fonctions de même signature, (ContexteExecution) =>
// ContexteExecution, enchaînées dans un ordre NORMATIF. Cette uniformité n'est
// pas de l'élégance : elle permet à index.ts de porter l'ordre comme une LISTE,
// donc de le rendre vérifiable par un test, et elle interdit qu'une étape lise
// un résultat qu'une étape ultérieure produira.
//
// Ce type ne peut pas vivre dans index.ts : index.ts importe les 17 étapes, et
// les 17 étapes importent ce type. Un fichier séparé évite le cycle.

import type { Clause } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import type { ContexteEcriture } from '../etat/mouvements.ts';
import type { EtatSession, Manche, PartManche } from '../etat/types.ts';

export interface AmendeLiquideeInterne {
  readonly accusation_id: string;
  readonly debiteur_joueur_id: string;
  readonly crediteur_joueur_id: string;
  readonly montant_liquide: number;
  readonly montant_du: number;
}

export interface ContexteExecution {
  readonly etat: EtatSession;
  readonly numero: number;
  readonly ecriture: ContexteEcriture;

  readonly total_declare: number;
  readonly total_paye: number;
  readonly menteurs: readonly string[];
  readonly ampleurs: ReadonlyMap<string, number>;
  readonly reussi: boolean;
  readonly multiplicateur: number;
  readonly recompense: number;
  readonly exclus: readonly string[];
  readonly poids: ReadonlyMap<string, number>;
  readonly parts: readonly PartManche[];
  readonly reliquat_non_distribue: number;
  readonly consolation_appliquee: boolean;
  readonly total_consolation: number | null;
  readonly bonus_epices_verse: boolean;
  readonly facteur_amende: number;
  readonly amendes: readonly AmendeLiquideeInterne[];
  readonly joueurs_touches: ReadonlySet<string>;
  readonly effets: readonly Effet[];
}

export function manchePipeline(contexte: ContexteExecution): Manche {
  const manche = contexte.etat.manches.find((m) => m.numero === contexte.numero);
  if (manche === undefined) {
    throw new Error(`Pipeline lancé sur une manche absente : ${contexte.numero}`);
  }
  return manche;
}

export function clauseActive(contexte: ContexteExecution, clause: Clause): boolean {
  return manchePipeline(contexte).clause_cle === clause;
}

/** Marque les joueurs dont le solde a bougé, pour ne projeter que ce qui a changé. */
export function avecJoueursTouches(
  contexte: ContexteExecution,
  etat: EtatSession,
  touches: readonly string[],
): ContexteExecution {
  return {
    ...contexte,
    etat,
    joueurs_touches: new Set([...contexte.joueurs_touches, ...touches]),
  };
}

export function contexteInitial(
  etat: EtatSession,
  numero: number,
  ecriture: ContexteEcriture,
): ContexteExecution {
  return {
    etat,
    numero,
    ecriture,
    total_declare: 0,
    total_paye: 0,
    menteurs: [],
    ampleurs: new Map(),
    reussi: false,
    multiplicateur: 0,
    recompense: 0,
    exclus: [],
    poids: new Map(),
    parts: [],
    reliquat_non_distribue: 0,
    consolation_appliquee: false,
    total_consolation: null,
    bonus_epices_verse: false,
    facteur_amende: 1,
    amendes: [],
    joueurs_touches: new Set(),
    effets: [],
  };
}
