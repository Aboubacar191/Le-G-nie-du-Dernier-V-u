// Tirage de la clause de la manche — RG-18 / CA-13 : tirage SANS REMISE, les 5 clauses d’une partie sont distinctes.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/index.ts';

export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
