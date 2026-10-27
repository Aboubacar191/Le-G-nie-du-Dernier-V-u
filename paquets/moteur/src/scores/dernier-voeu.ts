// Résolution du Dernier Vœu : table de résolution sur SUM(a_signe) (RG-53).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculScore = (etat: EtatSession) => unknown;
