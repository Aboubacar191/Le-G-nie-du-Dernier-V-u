// Stockage local du jeton de session (US-16).
//
// Seuls le jeton et l'identifiant de session sont persistés. AUCUNE donnée de
// jeu : à la reconnexion, tout provient de etat_complet_prive (RG-73). Une
// projection privée conservée sur l'appareil serait lisible après coup sur un
// téléphone prêté.
//
// La clé est purgée sur JETON_INVALIDE : un jeton mort qui traîne provoque des
// échecs d'authentification silencieux.
//
// AMORCE — renseignée par le nœud S5 (dev-frontend).

export const CLE_STOCKAGE_JETON = 'gdv.session';

export interface JetonStocke {
  readonly session_id: string;
  readonly jeton_session: string;
}

export type LireJeton = () => JetonStocke | null;
export type EcrireJeton = (jeton: JetonStocke) => void;
export type PurgerJeton = () => void;
