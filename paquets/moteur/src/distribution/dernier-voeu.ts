// Mode avancé : tirage du MARCHAND_DEJA_LIE et du GARDIEN_DE_LA_LAMPE (RG-50 et suivantes).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/index.ts';

export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
