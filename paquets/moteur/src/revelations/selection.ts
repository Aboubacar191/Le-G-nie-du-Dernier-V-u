// Sélection de la révélation et de sa variante de formulation (RG-25).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculRevelation = (etat: EtatSession) => unknown;
