// Pipeline d'exécution d'une manche — RG-40 : 17 étapes dans un ordre NORMATIF.
//
// Les étapes sont numérotées dans le nom du fichier pour que l'ordre de RG-40
// soit lisible dans l'arborescence. L'invariant monétaire du pipeline est
// vérifié après chaque étape (RG-41, RG-42).
//
// AMORCE — l'enchaînement est écrit par le nœud S4 (dev-backend).

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

/** Nombre d'étapes imposé par RG-40. Toute exécution les traverse toutes, dans l'ordre. */
export const NOMBRE_ETAPES_PIPELINE = 17;
