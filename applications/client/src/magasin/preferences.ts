// Préférences locales d'affichage, persistées PAR APPAREIL.
//
// Deux réglages seulement, et tous deux sont des conditions de jouabilité, pas
// du confort :
//  · le thème, parce que le jeu se joue en soirée comme en plein jour et que
//    les deux thèmes sont des livrables égaux ;
//  · le côté dominant, parce que la fenêtre de lecture d'un secret est ancrée
//    du côté que la main qui tient l'appareil occulte naturellement — à gauche
//    pour un gaucher, sinon le dispositif anti-regard ne protège plus rien (M4).
//
// Aucune donnée de jeu n'est persistée ici.

import { CLE_STOCKAGE_COTE, CLE_STOCKAGE_THEME, type StockageLocal } from '../transport/stockage-jeton.ts';

export const CHOIX_THEME = ['systeme', 'clair', 'sombre'] as const;
export type ChoixTheme = (typeof CHOIX_THEME)[number];

export const COTES = ['droite', 'gauche'] as const;
export type Cote = (typeof COTES)[number];

const estChoixTheme = (valeur: string | null): valeur is ChoixTheme =>
  valeur !== null && (CHOIX_THEME as readonly string[]).includes(valeur);

const estCote = (valeur: string | null): valeur is Cote =>
  valeur !== null && (COTES as readonly string[]).includes(valeur);

export const relireTheme = (stockage: StockageLocal): ChoixTheme => {
  const brut = stockage.getItem(CLE_STOCKAGE_THEME);
  return estChoixTheme(brut) ? brut : 'systeme';
};

export const ecrireTheme = (stockage: StockageLocal, choix: ChoixTheme): void =>
  stockage.setItem(CLE_STOCKAGE_THEME, choix);

export const relireCote = (stockage: StockageLocal): Cote => {
  const brut = stockage.getItem(CLE_STOCKAGE_COTE);
  return estCote(brut) ? brut : 'droite';
};

export const ecrireCote = (stockage: StockageLocal, cote: Cote): void =>
  stockage.setItem(CLE_STOCKAGE_COTE, cote);

/**
 * Applique le thème à la racine du document.
 *
 * « systeme » RETIRE l'attribut au lieu de calculer la préférence : la feuille
 * de jetons porte un bloc @media (prefers-color-scheme: dark) qui ne s'applique
 * qu'en l'absence d'attribut. La couleur est donc juste dès le premier rendu,
 * sans attendre le script, et il n'existe qu'une seule source de décision.
 */
export function appliquerTheme(racine: Element, choix: ChoixTheme): void {
  if (choix === 'systeme') {
    racine.removeAttribute('data-theme');
    return;
  }
  racine.setAttribute('data-theme', choix);
}

/** Applique le côté dominant, lu par les composants de voile en CSS. */
export function appliquerCote(racine: Element, cote: Cote): void {
  racine.setAttribute('data-cote-dominant', cote);
}
