// Distribution des rôles — RG-04 / CA-06 : 4 rôles tous présents, aucun au-delà de 2 exemplaires, 1 rôle par joueur.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/index.ts';

export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
