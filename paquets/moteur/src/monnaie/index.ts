// Arithmétique des montants : entiers exclusivement (ADR-TL-14).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
// Aucun flottant ne traverse le moteur, la base ou le fil. Les fractions du jeu
// sont des rationnels [numerateur, denominateur] lus dans la configuration.
// Les arrondis sont EXPLICITES et nommés : plancher et plafond sont utilisés à
// chaque étape du pipeline, jamais un arrondi implicite.

import type { Pieces, Rationnel } from '@gdv/partage';

/** plancher(a * n / d) en arithmétique entière. */
export type Plancher = (montant: Pieces, fraction: Rationnel) => Pieces;

/** plafond(a * n / d) en arithmétique entière. */
export type Plafond = (montant: Pieces, fraction: Rationnel) => Pieces;

/** Plafonne un prélèvement au solde disponible (RG-41 : aucun solde négatif). */
export type PlafonnerAuSolde = (montant: Pieces, solde: Pieces) => Pieces;
