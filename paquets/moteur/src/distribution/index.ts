// Distribution : l'ordre de consommation de l'aléa est NORMATIF
// (ARCHI conventions.determinisme_et_alea) : rôles, puis missions, puis — en
// mode avancé — MARCHAND_DEJA_LIE et GARDIEN_DE_LA_LAMPE, puis par manche :
// clause, porteur, variante de formulation.
//
// Le changer invalide le rejeu de tout journal existant. C'est pour cette
// raison que distribuerRolesModeAvance est appelée inconditionnellement et
// décide elle-même de ne rien faire : un appel conditionnel ferait dépendre la
// position du générateur du mode de jeu.

import type { Alea } from '../alea/interface.ts';
import { appliquerMouvements, type ContexteEcriture } from '../etat/mouvements.ts';
import type { EtatSession } from '../etat/types.ts';
import { distribuerRolesModeAvance } from './dernier-voeu.ts';
import { distribuerMissions } from './missions.ts';
import { distribuerRoles } from './roles.ts';

export * from './roles.ts';
export * from './missions.ts';
export * from './clauses.ts';
export * from './porteur.ts';
export * from './dernier-voeu.ts';

/**
 * Distribution complète : rôles, missions, rôles du mode avancé, puis dotation
 * initiale (RG-03) écrite comme mouvement de journal — jamais comme solde posé
 * à la main, sans quoi RG-42 serait fausse dès la première seconde.
 */
export function distribuer(
  etat: EtatSession,
  alea: Alea,
  ecriture: ContexteEcriture,
): EtatSession {
  const avecRoles = distribuerRoles(etat, alea);
  const avecMissions = distribuerMissions(avecRoles, alea);
  const avecModeAvance = distribuerRolesModeAvance(avecMissions, alea);

  if (etat.config.pieces_initiales === 0) return avecModeAvance;

  return appliquerMouvements(
    avecModeAvance,
    avecModeAvance.joueurs.map((joueur) => ({
      joueur_id: joueur.id,
      delta: etat.config.pieces_initiales,
      motif: 'dotation_initiale' as const,
      manche_numero: null,
    })),
    ecriture,
  );
}

/** Signature historique du squelette, conservée pour les consommateurs de types. */
export type Distribuer = (etat: EtatSession, alea: Alea) => EtatSession;
