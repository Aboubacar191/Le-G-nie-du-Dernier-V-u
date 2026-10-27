// Éligibilité d’un gabarit de révélation à la manche courante.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculRevelation = (etat: EtatSession) => unknown;
