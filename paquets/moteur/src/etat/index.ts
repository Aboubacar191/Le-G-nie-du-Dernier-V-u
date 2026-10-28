// État d'une session : construction initiale et invariants vérifiables.
//
// L'état naît VIDE de pièces : la dotation initiale est un mouvement de journal
// écrit à la distribution (RG-03), pas un solde posé à la main. RG-42 est donc
// vraie dès le premier instant de la partie, et pas seulement après la première
// transaction.

import type { ConfigJeu } from '@gdv/partage';
import { CLAUSE } from '@gdv/partage';

import type { EtatGroupeSession, EtatSession, Joueur } from './types.ts';

export type * from './types.ts';
export { verifierInvariants } from './types.ts';
export type * from './effets.ts';
export * from './acces.ts';
export * from './mouvements.ts';

export interface ParametresCreation {
  readonly session_id: string;
  readonly code_adhesion: string;
  readonly config: ConfigJeu;
  readonly mode_avance_actif: boolean;
  readonly groupe: EtatGroupeSession;
  readonly hote: { readonly joueur_id: string; readonly pseudo: string };
  readonly maintenant: number;
}

function nouveauJoueur(joueurId: string, pseudo: string, estHote: boolean): Joueur {
  return {
    id: joueurId,
    pseudo,
    est_hote: estHote,
    position_cercle: null,
    connecte: true,
    role_secret: null,
    mission_secrete: null,
    solde_pieces: 0,
    score_activite: 0,
    mission_reussie: null,
    score_final: null,
  };
}

/**
 * Session neuve, en état CREEE, l'hôte inscrit comme premier joueur.
 * clauses_disponibles porte le catalogue complet : le tirage est SANS REMISE au
 * sein d'une partie (RG-18), et c'est cette liste qui décroît.
 */
export function creerSession(parametres: ParametresCreation): EtatSession {
  return {
    session_id: parametres.session_id,
    code_adhesion: parametres.code_adhesion,
    etat_partie: 'CREEE',
    config: parametres.config,
    mode_avance_actif: parametres.mode_avance_actif,
    manche_courante: 0,
    phase: null,
    phase_fin_at: null,
    joueurs: [nouveauJoueur(parametres.hote.joueur_id, parametres.hote.pseudo, true)],
    manches: [],
    prets: [],
    mouvements: [],
    signatures: [],
    clauses_disponibles: CLAUSE,
    genie_libere: null,
    classement: null,
    vainqueurs: [],
    groupe: parametres.groupe,
    cree_le: parametres.maintenant,
    termine_le: null,
  };
}

export type ResultatAdhesion =
  | { readonly ok: true; readonly etat: EtatSession }
  | { readonly ok: false; readonly code: 'SESSION_PLEINE' | 'PSEUDO_INDISPONIBLE' | 'ETAT_PARTIE_INCOMPATIBLE' };

/**
 * Adhésion d'un joueur (RG-02, CA-03).
 * Refusée au-delà de joueurs_max, sur pseudo déjà pris DANS CETTE session — le
 * même pseudo dans une autre session est autorisé (cas limite SPEC) — et hors
 * des états CREEE et SALLE_ATTENTE : il n'existe pas de remplacement de joueur
 * en cours de partie.
 */
export function rejoindreSession(
  etat: EtatSession,
  nouveau: { readonly joueur_id: string; readonly pseudo: string },
): ResultatAdhesion {
  if (etat.etat_partie !== 'CREEE' && etat.etat_partie !== 'SALLE_ATTENTE') {
    return { ok: false, code: 'ETAT_PARTIE_INCOMPATIBLE' };
  }
  if (etat.joueurs.length >= etat.config.joueurs_max) {
    return { ok: false, code: 'SESSION_PLEINE' };
  }
  if (etat.joueurs.some((joueur) => joueur.pseudo === nouveau.pseudo)) {
    return { ok: false, code: 'PSEUDO_INDISPONIBLE' };
  }
  return {
    ok: true,
    etat: {
      ...etat,
      etat_partie: 'SALLE_ATTENTE',
      joueurs: [...etat.joueurs, nouveauJoueur(nouveau.joueur_id, nouveau.pseudo, false)],
    },
  };
}

/** Marque un joueur connecté ou déconnecté. La partie continue (RG-46, RG-32). */
export function definirConnexion(
  etat: EtatSession,
  joueurId: string,
  connecte: boolean,
): EtatSession {
  return {
    ...etat,
    joueurs: etat.joueurs.map((joueur) =>
      joueur.id === joueurId ? { ...joueur, connecte } : joueur,
    ),
  };
}
