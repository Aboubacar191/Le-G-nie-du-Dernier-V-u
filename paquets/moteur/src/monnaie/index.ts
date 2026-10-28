// Arithmétique des montants : entiers exclusivement (ADR-TL-14).
//
// Aucun flottant ne traverse le moteur, la base ou le fil. Les fractions du jeu
// sont des rationnels [numerateur, denominateur] lus dans la configuration.
// Les arrondis sont EXPLICITES et nommés : plancher et plafond sont deux
// fonctions distinctes, impossibles à confondre, et aucune étape du pipeline
// n'arrondit implicitement.
//
// plancher(a*n/d) se calcule sans quitter le domaine entier :
//   (a*n - ((a*n) mod d)) / d
// C'est la formule de l'ADR, et elle est exacte sur toute machine.

import type { Rationnel } from '@gdv/partage';

function produit(montant: number, fraction: Rationnel): { readonly haut: number; readonly bas: number } {
  const [numerateur, denominateur] = fraction;
  if (denominateur === 0) {
    throw new Error('Rationnel à dénominateur nul : la configuration est invalide.');
  }
  return { haut: montant * numerateur, bas: denominateur };
}

/** plancher(montant * n / d) en arithmétique entière. */
export function plancher(montant: number, fraction: Rationnel): number {
  const { haut, bas } = produit(montant, fraction);
  return (haut - (haut % bas)) / bas;
}

/** plafond(montant * n / d) en arithmétique entière. */
export function plafond(montant: number, fraction: Rationnel): number {
  const { haut, bas } = produit(montant, fraction);
  const reste = haut % bas;
  return reste === 0 ? haut / bas : (haut - reste) / bas + 1;
}

/** Complément d'une fraction : [n,d] → [d-n,d]. « Le génie garde un tiers » laisse deux tiers. */
export function complement(fraction: Rationnel): Rationnel {
  const [numerateur, denominateur] = fraction;
  return [denominateur - numerateur, denominateur];
}

/** Un plus une fraction : [n,d] → [d+n,d]. Le remboursement vaut principal × (1 + taux). */
export function unPlus(fraction: Rationnel): Rationnel {
  const [numerateur, denominateur] = fraction;
  return [denominateur + numerateur, denominateur];
}

/**
 * Plafonne un prélèvement au solde disponible (RG-41 : aucun solde négatif).
 * Les prélèvements involontaires — amende, pénalité, remboursement — sont
 * plafonnés a posteriori ; les actes volontaires sont refusés a priori.
 */
export function plafonnerAuSolde(montant: number, solde: number): number {
  return montant < solde ? montant : solde;
}

/** Somme entière d'une liste, sans réduction implicite sur les flottants. */
export function somme(valeurs: readonly number[]): number {
  let total = 0;
  for (const valeur of valeurs) total += valeur;
  return total;
}

/**
 * Part au prorata : plancher(total * poids / sommePoids).
 * Une somme de poids nulle ne verse AUCUNE part (étape 9) : le cas limite
 * « tous les contributeurs démasqués » doit rendre 0, pas une division par zéro.
 */
export function prorata(total: number, poids: number, sommePoids: number): number {
  if (sommePoids === 0) return 0;
  return plancher(total, [poids, sommePoids]);
}

export type Plancher = typeof plancher;
export type Plafond = typeof plafond;
export type PlafonnerAuSolde = typeof plafonnerAuSolde;
