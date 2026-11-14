// Score d'activité — RG-24, proxy de la loi 3 du génie (RG-22).
//
// « Le joueur qui a le plus parlé » n'est pas mesurable : la négociation est
// orale et l'application ne capte pas la parole. Seules les accusations sont
// des actes PUBLICS mesurables :
//   score_activite = nombre d'accusations ÉMISES, cumulé sur la partie.
//
// VERSION INITIALE FAUSSE ET CORRIGÉE (ANO-03, bloquant, mesuré par le QA) :
// le score comptait aussi les enquêtes (poids 2) et les transferts (poids 1),
// qui sont des actes SECRETS. La révélation PUBLIQUE du génie (selection.ts)
// départage ses candidats par ce score : un joueur qui se voyait ciblé plus
// souvent apprenait donc qu'il avait enquêté ou transféré — exactement ce que
// RG-27 interdit. AUCUN acte secret ou privé n'entre plus dans ce score : ni
// les enquêtes, ni les transferts, ni les prêts, ni les paiements.
//
// Ce score n'est émis dans AUCUN message (ARCHI : joueurs.score_activite est
// un champ secret). Il ne sert qu'au choix de la cible, côté serveur, et n'est
// lu nulle part ailleurs.

import { somme } from '../monnaie/index.ts';
import type { EtatSession } from '../etat/types.ts';

export function scoreActivite(etat: EtatSession, joueurId: string): number {
  return somme(
    etat.manches.map(
      (manche) =>
        manche.accusations.filter((a) => a.accusateur_joueur_id === joueurId).length,
    ),
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
