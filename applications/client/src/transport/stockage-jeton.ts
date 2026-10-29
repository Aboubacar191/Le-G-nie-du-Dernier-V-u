// Stockage local du jeton de session (US-16).
//
// Seuls le jeton, l'identifiant de session et l'identifiant de joueur sont
// persistés. AUCUNE donnée de jeu : à la reconnexion, tout provient de
// etat_complet_prive (RG-73). Une projection privée conservée sur l'appareil
// serait lisible après coup sur un téléphone prêté.
//
// La clé est purgée sur JETON_INVALIDE : un jeton mort qui traîne provoque des
// échecs d'authentification silencieux, et l'écran ECR-32 boucle.

export const CLE_STOCKAGE_JETON = 'gdv.session';
export const CLE_STOCKAGE_GROUPE = 'gdv.groupe';
export const CLE_STOCKAGE_THEME = 'gdv.theme';
export const CLE_STOCKAGE_COTE = 'gdv.cote-dominant';

export interface JetonStocke {
  readonly session_id: string;
  readonly jeton_session: string;
  readonly joueur_id: string;
  readonly est_hote: boolean;
  readonly url_temps_reel: string;
}

export type LireJeton = () => JetonStocke | null;
export type EcrireJeton = (jeton: JetonStocke) => void;
export type PurgerJeton = () => void;

/** Interface minimale de stockage, pour que la persistance soit testable. */
export interface StockageLocal {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

const CHAMPS_TEXTE = ['session_id', 'jeton_session', 'joueur_id', 'url_temps_reel'] as const;

/**
 * Relit le jeton. Toute forme inattendue est traitée comme une absence : un
 * objet partiel provoquerait un échec d'authentification que le joueur ne
 * pourrait pas comprendre.
 */
export function relireJeton(stockage: StockageLocal): JetonStocke | null {
  const brut = stockage.getItem(CLE_STOCKAGE_JETON);
  if (brut === null) return null;
  try {
    const objet: unknown = JSON.parse(brut);
    if (objet === null || typeof objet !== 'object') return null;
    const candidat = objet as Record<string, unknown>;
    if (!CHAMPS_TEXTE.every((champ) => typeof candidat[champ] === 'string')) return null;
    return Object.freeze({
      session_id: candidat.session_id as string,
      jeton_session: candidat.jeton_session as string,
      joueur_id: candidat.joueur_id as string,
      est_hote: candidat.est_hote === true,
      url_temps_reel: candidat.url_temps_reel as string,
    });
  } catch {
    return null;
  }
}

export function ecrireJeton(stockage: StockageLocal, jeton: JetonStocke): void {
  stockage.setItem(CLE_STOCKAGE_JETON, JSON.stringify(jeton));
}

export function purgerJeton(stockage: StockageLocal): void {
  stockage.removeItem(CLE_STOCKAGE_JETON);
}

/**
 * Jeton de groupe de l'hôte (RG-50 : compteur de parties terminées). Persisté
 * séparément du jeton de session : il survit à la fin d'une partie, c'est son
 * objet même.
 */
export const relireJetonGroupe = (stockage: StockageLocal): string | null =>
  stockage.getItem(CLE_STOCKAGE_GROUPE);

export const ecrireJetonGroupe = (stockage: StockageLocal, jeton: string): void =>
  stockage.setItem(CLE_STOCKAGE_GROUPE, jeton);
