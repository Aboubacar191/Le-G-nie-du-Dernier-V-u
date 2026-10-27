// Classement final et désignation des vainqueurs (RG-58).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculScore = (etat: EtatSession) => unknown;
