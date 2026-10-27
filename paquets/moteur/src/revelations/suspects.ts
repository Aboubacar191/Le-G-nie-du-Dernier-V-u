// Calcul de l’ensemble des suspects — RG-21 : suspects_restants_apres >= 2.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculRevelation = (etat: EtatSession) => unknown;
