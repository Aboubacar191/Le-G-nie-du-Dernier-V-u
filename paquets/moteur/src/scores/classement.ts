// Classement final et désignation des vainqueurs — RG-55, RG-56, RG-57.
//
//   score = pieces_restantes + bonus_mission_reussie si la mission est réussie.
//   Le plus haut score gagne. Personne n'est éliminé en cours de partie.
//   Égalité : départage par pieces_restantes, puis ex aequo déclaré.
//   Si genie_libere, le MARCHAND_DEJA_LIE est vainqueur UNIQUE, le classement
//   par points restant affiché à titre informatif.

import { missionReussie } from './missions.ts';
import type { EtatSession, LigneClassementInterne } from '../etat/types.ts';

export interface Classement {
  readonly etat: EtatSession;
  readonly lignes: readonly LigneClassementInterne[];
  readonly vainqueurs: readonly string[];
  readonly victoire_par_liberation: boolean;
}

type LigneSansRang = Omit<LigneClassementInterne, 'rang'>;

/** RG-57 : départage par pièces restantes, puis ex aequo DÉCLARÉ — même rang. */
function attribuerRangs(brut: readonly LigneSansRang[]): readonly LigneClassementInterne[] {
  const trie = [...brut].sort(
    (a, b) => b.score_final - a.score_final || b.pieces_restantes - a.pieces_restantes,
  );
  const lignes: LigneClassementInterne[] = [];
  let rangCourant = 0;
  let precedent: { score: number; pieces: number } | null = null;
  for (const [index, ligne] of trie.entries()) {
    const exAequo =
      precedent !== null &&
      precedent.score === ligne.score_final &&
      precedent.pieces === ligne.pieces_restantes;
    rangCourant = exAequo ? rangCourant : index + 1;
    precedent = { score: ligne.score_final, pieces: ligne.pieces_restantes };
    lignes.push({ ...ligne, rang: rangCourant });
  }
  return lignes;
}

function lignesBrutes(etat: EtatSession): readonly LigneSansRang[] {
  const bonus = etat.config.bonus_mission_reussie;
  return etat.joueurs.map((joueur) => {
    const reussie = missionReussie(etat, joueur.id, joueur.mission_secrete);
    return {
      joueur_id: joueur.id,
      pieces_restantes: joueur.solde_pieces,
      score_final: joueur.solde_pieces + (reussie ? bonus : 0),
      mission_reussie: reussie,
    };
  });
}

/**
 * Calcule les missions, les scores, les rangs et les vainqueurs, puis fige le
 * tout dans l'état. L'ordre est imposé par catalogue_missions : LE_MAGNAT est
 * évalué AVANT l'ajout des bonus, donc sur les seules pièces restantes — c'est
 * pourquoi missionReussie lit etat.joueurs et non le classement en cours.
 */
export function calculerClassement(etat: EtatSession): Classement {
  const lignes = attribuerRangs(lignesBrutes(etat));
  const marchandDejaLie = etat.joueurs.find(
    (joueur) => joueur.role_secret === 'MARCHAND_DEJA_LIE',
  );
  const parLiberation = etat.genie_libere === true && marchandDejaLie !== undefined;
  const vainqueurs = parLiberation
    ? [marchandDejaLie.id]
    : lignes.filter((ligne) => ligne.rang === 1).map((ligne) => ligne.joueur_id);

  return {
    lignes,
    vainqueurs,
    victoire_par_liberation: parLiberation,
    etat: {
      ...etat,
      classement: lignes,
      vainqueurs,
      joueurs: etat.joueurs.map((joueur) => {
        const ligne = lignes.find((l) => l.joueur_id === joueur.id);
        return ligne === undefined
          ? joueur
          : { ...joueur, mission_reussie: ligne.mission_reussie, score_final: ligne.score_final };
      }),
    },
  };
}
