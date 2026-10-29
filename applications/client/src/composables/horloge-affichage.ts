// Horloge d'AFFICHAGE : un seul battement pour toute l'application.
//
// Elle ne décide de rien. L'instant qu'elle publie sert uniquement à recalculer
// le décompte dérivé de phase_fin_at corrigé du décalage (RG-79) ; l'autorité
// de l'expiration appartient au serveur (RG-72).
//
// Un seul intervalle, partagé : trente composants qui arment chacun leur
// minuterie réveilleraient le téléphone trente fois par seconde pour afficher
// le même chiffre.
//
// Sous prefers-reduced-motion, le pas passe à une seconde : l'arc avance par
// crans au lieu de glisser. C'est une préférence de mouvement, pas une
// dégradation de l'information — le nombre de secondes reste exact.

import { onScopeDispose, readonly, ref, type Ref } from 'vue';

import { pasRafraichissementMs } from '../logique/decompte.ts';

export function mouvementReduit(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

let instant: Ref<number> | null = null;
let intervalle: ReturnType<typeof setInterval> | null = null;
let abonnes = 0;

function demarrer(): void {
  if (intervalle !== null) return;
  const pas = pasRafraichissementMs(mouvementReduit());
  intervalle = setInterval(() => {
    if (instant !== null) instant.value = Date.now();
  }, pas);
}

function arreter(): void {
  if (intervalle === null) return;
  clearInterval(intervalle);
  intervalle = null;
}

/**
 * Instant courant en millisecondes, rafraîchi au pas du contrat de conception.
 * L'intervalle s'arrête dès qu'aucun composant n'est abonné.
 */
export function utiliserHorlogeAffichage(): Readonly<Ref<number>> {
  instant ??= ref(Date.now());
  abonnes += 1;
  demarrer();

  onScopeDispose(() => {
    abonnes -= 1;
    if (abonnes <= 0) arreter();
  });

  return readonly(instant);
}

/** Remise à zéro, pour les tests : aucune minuterie ne survit à un cas. */
export function reinitialiserHorloge(): void {
  arreter();
  instant = null;
  abonnes = 0;
}
