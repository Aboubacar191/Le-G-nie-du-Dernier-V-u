// Limitation de débit (ARCHI standards.limitation_debit).
//
//  · temps réel : 20 commandes par fenêtre glissante de 10 s et par connexion,
//    puis TROP_DE_REQUETES ; 3 dépassements consécutifs ferment la connexion ;
//  · adhésion REST : 10 tentatives par minute et par adresse IP ;
//  · création REST : 5 sessions par minute et par adresse IP.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export const COMMANDES_PAR_FENETRE = 20;
export const FENETRE_GLISSANTE_MS = 10_000;
export const DEPASSEMENTS_AVANT_FERMETURE = 3;
export const ADHESIONS_PAR_MINUTE_PAR_IP = 10;
export const CREATIONS_PAR_MINUTE_PAR_IP = 5;

export type Limiteur = (cle: string) => { autorise: boolean; doitFermer: boolean };
