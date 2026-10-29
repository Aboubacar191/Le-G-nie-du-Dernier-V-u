// Dérivation du décompte de phase et de son niveau d'urgence.
//
// Trois canaux redondants portent le temps restant (DESIGN / Minuteur) : le
// NOMBRE de secondes, la LONGUEUR de l'arc, et le jeton de couleur. Jamais la
// couleur seule : un joueur qui ne distingue pas les teintes lit le nombre et
// voit l'arc.
//
// Le décompte dérive de phase_fin_at corrigé du décalage d'horloge (RG-79). Il
// ne pilote aucune soumission : l'autorité de l'expiration est au serveur
// (RG-72).

import { MINUTEUR } from '../styles/jetons.ts';
import type { EtatDecalage } from './decalage-horloge.ts';
import { restantMs } from './decalage-horloge.ts';

const MS_PAR_SECONDE = 1000;

/**
 * État du minuteur. « chargement » signifie échéance inconnue : le nombre est
 * remplacé par deux tirets, jamais par un zéro.
 */
export type NiveauMinuteur = 'chargement' | 'calme' | 'tension' | 'critique' | 'expire';

export interface Decompte {
  readonly niveau: NiveauMinuteur;
  /** Secondes restantes, arrondies vers le haut. Null si l'échéance est inconnue. */
  readonly secondes: number | null;
  /** Fraction de phase restante dans [0, 1], pour la longueur de l'arc. */
  readonly fraction: number;
}

export const DECOMPTE_INCONNU: Decompte = Object.freeze({
  niveau: 'chargement',
  secondes: null,
  fraction: 1,
});

function niveauPour(secondes: number): NiveauMinuteur {
  if (secondes <= 0) return 'expire';
  if (secondes <= MINUTEUR['seuil-critique-s']) return 'critique';
  if (secondes <= MINUTEUR['seuil-tension-s']) return 'tension';
  return 'calme';
}

/**
 * Calcule le décompte affichable.
 *
 * @param dureePhaseS durée totale de la phase, pour la fraction d'arc. Une
 *                    durée nulle ou inconnue donne une fraction de 1 : un arc
 *                    plein vaut mieux qu'une division par zéro.
 */
export function calculerDecompte(
  decalage: EtatDecalage,
  echeanceIso: string | null,
  maintenantMs: number,
  dureePhaseS: number | null,
): Decompte {
  const restant = restantMs(decalage, echeanceIso, maintenantMs);
  if (restant === null) return DECOMPTE_INCONNU;

  const secondes = Math.max(0, Math.ceil(restant / MS_PAR_SECONDE));
  const total = dureePhaseS !== null && dureePhaseS > 0 ? dureePhaseS : null;
  const fraction = total === null ? 1 : Math.min(1, Math.max(0, secondes / total));

  return Object.freeze({ niveau: niveauPour(secondes), secondes, fraction });
}

/** Mise en forme m:ss. Les chiffres sont tabulaires : la largeur ne bouge pas. */
export function formaterDecompte(secondes: number | null): string {
  if (secondes === null) return '——';
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${minutes}:${String(reste).padStart(2, '0')}`;
}

/**
 * Pas de rafraîchissement de l'affichage, en millisecondes.
 *
 * Sous prefers-reduced-motion, l'arc avance par crans d'une seconde au lieu de
 * glisser : le mouvement continu est une animation, le décompte ne l'est pas.
 */
export function pasRafraichissementMs(mouvementReduit: boolean): number {
  return mouvementReduit
    ? MINUTEUR['pas-rafraichissement-mouvement-reduit-ms']
    : MINUTEUR['pas-rafraichissement-ms'];
}
