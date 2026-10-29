// Saisie d'un montant par incrémenteur — RG-78.
//
// Aucun clavier numérique, nulle part, pour aucun montant. input[type=number]
// est contractuellement interdit : un clavier logiciel consomme la moitié d'une
// fenêtre de 30 secondes et affiche la valeur en grand au centre de l'écran,
// donc au voisin assis à côté.
//
// Ce module ne porte AUCUNE règle de jeu. Les bornes lui sont fournies : elles
// viennent du serveur (solde pour RG-08, montant déclaré pour RG-09) et
// l'autorité du refus reste au serveur, qui revérifie tout. Ici, on borne pour
// que l'interface n'offre pas un geste voué au refus.

/** Bornes d'un incrémenteur. Fournies, jamais calculées depuis des règles. */
export interface Bornes {
  readonly min: number;
  readonly max: number;
}

export const bornes = (min: number, max: number): Bornes =>
  Object.freeze({ min, max: Math.max(min, max) });

/** Ramène une valeur dans ses bornes, en entier. Jamais de flottant (ADR-TL-14). */
export function borner(valeur: number, limites: Bornes): number {
  const entier = Math.trunc(Number.isFinite(valeur) ? valeur : limites.min);
  if (entier < limites.min) return limites.min;
  if (entier > limites.max) return limites.max;
  return entier;
}

/** Pas d'ajustement fin et pas rapide, au clavier (Flèches et Page haut/bas). */
export const PAS_UNITAIRE = 1;
export const PAS_RAPIDE = 5;

export function incrementer(valeur: number, limites: Bornes, pas = PAS_UNITAIRE): number {
  return borner(valeur + pas, limites);
}

export function decrementer(valeur: number, limites: Bornes, pas = PAS_UNITAIRE): number {
  return borner(valeur - pas, limites);
}

/** Vrai quand le pas « plus » doit passer en état borne_atteinte. */
export const borneHauteAtteinte = (valeur: number, limites: Bornes): boolean =>
  valeur >= limites.max;

/** Vrai quand le pas « moins » doit passer en état borne_atteinte. */
export const borneBasseAtteinte = (valeur: number, limites: Bornes): boolean =>
  valeur <= limites.min;

/**
 * Un raccourci de montant : trois à quatre jetons sous l'incrémenteur, qui
 * ramènent la tâche courante à deux contacts (un jeton, puis valider).
 *
 * `cle_contenu` pointe le libellé dans contenu/fr.json : aucun texte ici.
 */
export interface Raccourci {
  readonly cle_contenu: string;
  readonly valeur: number;
}

const raccourci = (cle: string, valeur: number, limites: Bornes): Raccourci =>
  Object.freeze({ cle_contenu: cle, valeur: borner(valeur, limites) });

/** Raccourcis de la déclaration publique : Rien, la part attendue, tout mon or. */
export function raccourcisDeclaration(
  limites: Bornes,
  objectifParJoueur: number,
  solde: number,
): readonly Raccourci[] {
  return Object.freeze([
    raccourci('incrementeur.raccourci_rien', 0, limites),
    raccourci('incrementeur.raccourci_part_attendue', objectifParJoueur, limites),
    raccourci('incrementeur.raccourci_tout_mon_or', solde, limites),
  ]);
}

/**
 * Raccourcis du paiement secret. Leurs libellés sont eux-mêmes des informations
 * secrètes (« Tout ce que j'ai promis » renseigne sur le montant) : ils vivent
 * donc à l'INTÉRIEUR du voile.
 */
export function raccourcisPaiement(limites: Bornes, declare: number): readonly Raccourci[] {
  return Object.freeze([
    raccourci('incrementeur.raccourci_rien', 0, limites),
    raccourci('incrementeur.raccourci_moitie', Math.floor(declare / 2), limites),
    raccourci('incrementeur.raccourci_tout_promis', declare, limites),
  ]);
}

/** Raccourcis d'un transfert ou d'un prêt, dans une feuille modale. */
export function raccourcisTransfert(limites: Bornes, solde: number): readonly Raccourci[] {
  const un = 1;
  const trois = 3;
  return Object.freeze([
    raccourci('incrementeur.raccourci_un', un, limites),
    raccourci('incrementeur.raccourci_trois', trois, limites),
    raccourci('incrementeur.raccourci_tout_mon_or', solde, limites),
  ]);
}
