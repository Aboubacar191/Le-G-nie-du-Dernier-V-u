// Mode avancé : tirage du MARCHAND_DEJA_LIE et du GARDIEN_DE_LA_LAMPE
// (RG-51, RG-52). Tirage effectué à la DISTRIBUTION, comme l'impose
// machine_etats_partie (« le cas échéant les rôles du mode avancé »), et non à
// l'entrée du Dernier Vœu : le MARCHAND_DEJA_LIE doit pouvoir jouer son rôle
// pendant les cinq manches.
//
// LECTURE LITTÉRALE, consignée : RG-51 donne au joueur tiré le rôle secret
// MARCHAND_DEJA_LIE « À LA PLACE de sa mission secrète ». Le protocole ne porte
// qu'un seul champ role_secret et classe MARCHAND_DEJA_LIE parmi les CleRole,
// avec mission_secrete nulle (EvtAttributionPrivee). Le joueur tiré perd donc
// son rôle de base, et les 4 rôles de base peuvent ne plus être tous présents
// en mode avancé. Aucune contrainte de tirage n'est inventée pour l'éviter :
// ce serait ajouter une règle que la SPEC ne porte pas. CA-06 est vérifié sur
// la distribution de base, ce que son énoncé décrit (« 1 rôle ET 1 mission »).

import type { Mission, Role } from '@gdv/partage';

import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/types.ts';

const ROLE_MARCHAND_DEJA_LIE: Role = 'MARCHAND_DEJA_LIE';
const MISSION_GARDIEN: Mission = 'GARDIEN_DE_LA_LAMPE';
const EFFECTIF_MINIMAL_MODE_AVANCE = 2;

/**
 * Attribue les deux rôles du mode avancé à deux joueurs DISTINCTS (RG-51/52).
 * Sans effet si le mode avancé est inactif : la fonction est appelée
 * inconditionnellement pour que l'ordre de consommation de l'aléa ne dépende
 * pas du mode — ce serait un rejeu faux d'une session à l'autre.
 */
export function distribuerRolesModeAvance(etat: EtatSession, alea: Alea): EtatSession {
  if (!etat.mode_avance_actif) return etat;
  if (etat.joueurs.length < EFFECTIF_MINIMAL_MODE_AVANCE) {
    throw new Error(
      'Mode avancé impossible : RG-51 et RG-52 exigent deux joueurs distincts.',
    );
  }

  const melange = alea.melanger(etat.joueurs.map((joueur) => joueur.id));
  const marchand = melange[0];
  const gardien = melange[1];
  if (marchand === undefined || gardien === undefined) {
    throw new Error('Tirage du mode avancé incomplet : défaut du mélange.');
  }

  return {
    ...etat,
    joueurs: etat.joueurs.map((joueur) => {
      if (joueur.id === marchand) {
        return { ...joueur, role_secret: ROLE_MARCHAND_DEJA_LIE, mission_secrete: null };
      }
      if (joueur.id === gardien) {
        return { ...joueur, mission_secrete: MISSION_GARDIEN };
      }
      return joueur;
    }),
  };
}
