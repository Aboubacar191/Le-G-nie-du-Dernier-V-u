// RG-20 : revérification INDÉPENDANTE qu’une révélation est vraie, par une fonction distincte de celle qui l’a sélectionnée. Une révélation non vérifiée ne peut pas être écrite, donc pas émise.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculRevelation = (etat: EtatSession) => unknown;
