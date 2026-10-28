// Score d'activité — RG-24, proxy de la loi 3 du génie (RG-22).
//
// « Le joueur qui a le plus parlé » n'est pas mesurable : la négociation est
// orale et l'application ne capte pas la parole. Proxy retenu par la SPEC :
//   score_activite = 3 × accusations émises + 2 × enquêtes lancées
//                    + 1 × transferts initiés, cumulé sur la partie.
//
// Ce score n'est émis dans AUCUN message (ARCHI : joueurs.score_activite est
// un champ secret) : il laisse deviner les enquêtes lancées, qui sont secrètes
// (RG-27). Il ne sert qu'au choix de la cible, côté serveur.
//
// Les trois poids ne sont pas des paramètres d'équilibrage : ils appartiennent à
// l'énoncé de RG-24. Ils sont nommés, et lus nulle part ailleurs.

import { somme } from '../monnaie/index.ts';
import type { EtatSession } from '../etat/types.ts';

const POIDS_ACCUSATION = 3;
const POIDS_ENQUETE = 2;
const POIDS_TRANSFERT = 1;
const MOTIF_TRANSFERT_EMIS = 'transfert_emis';

export function scoreActivite(etat: EtatSession, joueurId: string): number {
  const accusations = somme(
    etat.manches.map(
      (manche) =>
        manche.accusations.filter((a) => a.accusateur_joueur_id === joueurId).length,
    ),
  );
  const enquetes = somme(
    etat.manches.map(
      (manche) => manche.enquetes.filter((e) => e.enqueteur_joueur_id === joueurId).length,
    ),
  );
  const transferts = etat.mouvements.filter(
    (mouvement) => mouvement.joueur_id === joueurId && mouvement.motif === MOTIF_TRANSFERT_EMIS,
  ).length;

  return (
    POIDS_ACCUSATION * accusations + POIDS_ENQUETE * enquetes + POIDS_TRANSFERT * transferts
  );
}

/**
 * Recalcule et fige le score de chaque joueur. Appelée après tout acte qui
 * l'alimente, pour que la colonne persistée ne soit jamais une seconde vérité.
 */
export function recalculerScoresActivite(etat: EtatSession): EtatSession {
  return {
    ...etat,
    joueurs: etat.joueurs.map((joueur) => ({
      ...joueur,
      score_activite: scoreActivite(etat, joueur.id),
    })),
  };
}
