// Cumul du score d’activité (RG-24). Jamais émis : il trahirait les enquêtes.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculRevelation = (etat: EtatSession) => unknown;
