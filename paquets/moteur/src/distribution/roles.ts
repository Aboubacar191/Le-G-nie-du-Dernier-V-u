// Distribution des rôles — RG-04 / CA-06.
//
// « Les 4 rôles sont attribués en un exemplaire chacun, puis les joueurs
//   surnuméraires reçoivent un doublon tiré au sort, sans qu'un rôle dépasse
//   2 exemplaires. »
//
// MARCHAND_DEJA_LIE est exclu du tirage de base : il relève du seul mode avancé
// (RG-51) et son attribution est un acte distinct, postérieur.

import { ROLE, type Role } from '@gdv/partage';

import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/types.ts';

const ROLE_MODE_AVANCE: Role = 'MARCHAND_DEJA_LIE';
const EXEMPLAIRES_MAX_PAR_ROLE = 2;

/** Les 4 rôles du catalogue de base (catalogue_roles de la SPEC). */
export const ROLES_BASE: readonly Role[] = ROLE.filter((role) => role !== ROLE_MODE_AVANCE);

function comptagePar(roles: readonly Role[]): Map<Role, number> {
  const comptage = new Map<Role, number>();
  for (const role of roles) comptage.set(role, (comptage.get(role) ?? 0) + 1);
  return comptage;
}

/**
 * Compose la main de rôles pour un effectif donné, puis la mélange.
 * Un effectif inférieur au nombre de rôles — possible seulement par surcharge
 * de configuration (US-17) — distribue un sous-ensemble tiré au sort : aucun
 * joueur ne peut rester sans rôle, et aucun rôle ne peut être attribué deux
 * fois avant que tous l'aient été une fois.
 */
export function composerMainRoles(effectif: number, alea: Alea): readonly Role[] {
  if (effectif <= ROLES_BASE.length) {
    return alea.melanger(ROLES_BASE).slice(0, effectif);
  }
  const main: Role[] = [...ROLES_BASE];
  while (main.length < effectif) {
    const comptage = comptagePar(main);
    const candidats = ROLES_BASE.filter(
      (role) => (comptage.get(role) ?? 0) < EXEMPLAIRES_MAX_PAR_ROLE,
    );
    if (candidats.length === 0) {
      throw new Error(
        `Effectif ${effectif} incompatible avec RG-04 : ${ROLES_BASE.length} rôles ` +
          `à ${EXEMPLAIRES_MAX_PAR_ROLE} exemplaires au plus ne couvrent pas la table.`,
      );
    }
    main.push(alea.choisir(candidats));
  }
  return alea.melanger(main);
}

/** Attribue un rôle à chaque joueur, dans l'ordre d'arrivée. */
export function distribuerRoles(etat: EtatSession, alea: Alea): EtatSession {
  const main = composerMainRoles(etat.joueurs.length, alea);
  return {
    ...etat,
    joueurs: etat.joueurs.map((joueur, index) => {
      const role = main[index];
      if (role === undefined) {
        throw new Error('Main de rôles trop courte : défaut de composition.');
      }
      return { ...joueur, role_secret: role };
    }),
  };
}
