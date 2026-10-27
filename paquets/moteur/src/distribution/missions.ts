// Distribution des missions — 1 mission secrète par joueur.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/index.ts';

export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
