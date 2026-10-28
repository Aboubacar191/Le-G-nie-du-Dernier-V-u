// Distribution des missions — RG-05.
//
// « Les 5 missions sont attribuées distinctes tant que l'effectif le permet,
//   puis par doublons tirés au sort. »
//
// Lecture littérale : la SPEC ne plafonne PAS le nombre d'exemplaires d'une
// mission, contrairement à RG-04 pour les rôles. Les doublons sont donc tirés
// uniformément parmi les 5 missions de base, ce qui autorise deux exemplaires
// de LE_MAGNAT (cas limite explicitement listé par la SPEC) et, à 8 joueurs,
// jusqu'à trois. Aucun plafond n'est inventé ici : ce serait ajouter une règle.
//
// GARDIEN_DE_LA_LAMPE est exclu du tirage de base : il relève du seul mode
// avancé (RG-52).

import { MISSION, type Mission } from '@gdv/partage';

import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/types.ts';

const MISSION_MODE_AVANCE: Mission = 'GARDIEN_DE_LA_LAMPE';

/** Les 5 missions du catalogue de base (catalogue_missions de la SPEC). */
export const MISSIONS_BASE: readonly Mission[] = MISSION.filter(
  (mission) => mission !== MISSION_MODE_AVANCE,
);

export function composerMainMissions(effectif: number, alea: Alea): readonly Mission[] {
  if (effectif <= MISSIONS_BASE.length) {
    return alea.melanger(MISSIONS_BASE).slice(0, effectif);
  }
  const main: Mission[] = [...MISSIONS_BASE];
  while (main.length < effectif) main.push(alea.choisir(MISSIONS_BASE));
  return alea.melanger(main);
}

export function distribuerMissions(etat: EtatSession, alea: Alea): EtatSession {
  const main = composerMainMissions(etat.joueurs.length, alea);
  return {
    ...etat,
    joueurs: etat.joueurs.map((joueur, index) => {
      const mission = main[index];
      if (mission === undefined) {
        throw new Error('Main de missions trop courte : défaut de composition.');
      }
      return { ...joueur, mission_secrete: mission };
    }),
  };
}
