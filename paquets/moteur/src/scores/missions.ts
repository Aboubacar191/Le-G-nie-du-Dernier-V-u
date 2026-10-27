// Évaluation de la réussite des missions secrètes.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatSession } from '../etat/index.ts';

export type CalculScore = (etat: EtatSession) => unknown;
