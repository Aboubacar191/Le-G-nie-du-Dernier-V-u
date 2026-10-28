// Pipeline d'exécution d'une manche — RG-40 : 17 étapes dans un ordre NORMATIF.
//
// L'ordre est porté par une LISTE, et non par un enchaînement d'appels
// imbriqués : il est ainsi lisible d'un coup d'œil, et un test peut vérifier
// que la liste comporte exactement 17 entrées et qu'elles sont dans l'ordre des
// noms de fichiers. « L'ordre est normatif : le changer change les résultats. »
//
// Les étapes sont numérotées dans le nom du fichier pour que l'ordre de RG-40
// soit lisible dans l'arborescence.

import { verifierInvariants } from '../etat/index.ts';
import type { ContexteEcriture } from '../etat/mouvements.ts';
import type { EtatSession } from '../etat/types.ts';
import { contexteInitial, type ContexteExecution } from './contexte.ts';
import { etape01 } from './etape-01.ts';
import { etape02 } from './etape-02.ts';
import { etape03 } from './etape-03.ts';
import { etape04 } from './etape-04.ts';
import { etape05 } from './etape-05.ts';
import { etape06 } from './etape-06.ts';
import { etape07 } from './etape-07.ts';
import { etape08 } from './etape-08.ts';
import { etape09 } from './etape-09.ts';
import { etape10 } from './etape-10.ts';
import { etape11 } from './etape-11.ts';
import { etape12 } from './etape-12.ts';
import { etape13 } from './etape-13.ts';
import { etape14 } from './etape-14.ts';
import { etape15 } from './etape-15.ts';
import { etape16 } from './etape-16.ts';
import { etape17 } from './etape-17.ts';

export type { ContexteExecution, AmendeLiquideeInterne } from './contexte.ts';
export type { Etape01 } from './etape-01.ts';
export type { Etape02 } from './etape-02.ts';
export type { Etape03 } from './etape-03.ts';
export type { Etape04 } from './etape-04.ts';
export type { Etape05 } from './etape-05.ts';
export type { Etape06 } from './etape-06.ts';
export type { Etape07 } from './etape-07.ts';
export type { Etape08 } from './etape-08.ts';
export type { Etape09 } from './etape-09.ts';
export type { Etape10 } from './etape-10.ts';
export type { Etape11 } from './etape-11.ts';
export type { Etape12 } from './etape-12.ts';
export type { Etape13 } from './etape-13.ts';
export type { Etape14 } from './etape-14.ts';
export type { Etape15 } from './etape-15.ts';
export type { Etape16 } from './etape-16.ts';
export type { Etape17 } from './etape-17.ts';

/** L'ordre normatif, sous la seule forme qui se relise : une liste. */
export const ETAPES: readonly ((contexte: ContexteExecution) => ContexteExecution)[] = [
  etape01,
  etape02,
  etape03,
  etape04,
  etape05,
  etape06,
  etape07,
  etape08,
  etape09,
  etape10,
  etape11,
  etape12,
  etape13,
  etape14,
  etape15,
  etape16,
  etape17,
];

/** Nombre d'étapes imposé par RG-40. Toute exécution les traverse toutes, dans l'ordre. */
export const NOMBRE_ETAPES_PIPELINE = 17;

/**
 * Exécute la manche. Les invariants monétaires sont vérifiés APRÈS CHAQUE ÉTAPE
 * (ARCHI invariants_testes_obligatoires) : un solde négatif ou une incohérence
 * entre solde et journal interrompt l'exécution là où elle a été produite, et
 * non trois étapes plus loin où le diagnostic serait perdu.
 */
export function executerPipeline(
  etat: EtatSession,
  numero: number,
  ecriture: ContexteEcriture,
): ContexteExecution {
  let contexte = contexteInitial(etat, numero, ecriture);
  for (const [index, etape] of ETAPES.entries()) {
    contexte = etape(contexte);
    const rapport = verifierInvariants(contexte.etat);
    if (!rapport.ok) {
      throw new Error(
        `Invariant monétaire violé après l'étape ${index + 1} du pipeline : ` +
          `soldes négatifs [${rapport.solde_negatif.join(', ')}], ` +
          `soldes incohérents avec le journal [${rapport.solde_incoherent.join(', ')}] ` +
          `(RG-41, RG-42).`,
      );
    }
  }
  return contexte;
}
