// Tirage du porteur de clause — son identité ne sort JAMAIS en v1 (matrice_visibilite).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/index.ts';

export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
