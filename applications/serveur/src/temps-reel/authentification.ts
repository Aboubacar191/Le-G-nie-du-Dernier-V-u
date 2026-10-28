// Authentification du canal temps réel.
//
// Séquence imposée (API / x-temps-reel.authentification) :
//   1. le client ouvre la connexion. Le socket est anonyme et ne reçoit RIEN ;
//   2. première trame OBLIGATOIRE : authentifier, portant jeton_session et
//      version_protocole ;
//   3. le serveur hache le jeton en SHA-256 et le compare À TEMPS CONSTANT au
//      condensat stocké. Échec : erreur JETON_INVALIDE puis fermeture (4401) ;
//   4. succès : la connexion est liée au joueur_id et etat_complet_prive part
//      immédiatement, projeté pour ce joueur seul (RG-73).
//
// Aucun jeton ne circule dans l'URL, ni dans le chemin, ni en paramètre : une
// URL finit dans les journaux d'accès et l'historique du navigateur.

import { CmdAuthentifier } from '@gdv/partage';

import { hacher, jetonCorrespond } from '../securite/jetons.ts';
import type { Depot } from '../persistance/depot.ts';

export type ResultatAuthentification =
  | { readonly ok: true; readonly joueur_id: string; readonly session_id: string }
  | {
      readonly ok: false;
      readonly code: 'MESSAGE_MALFORME' | 'JETON_INVALIDE' | 'ETAT_PARTIE_INCOMPATIBLE';
      readonly message: string;
    };

/**
 * La version MAJEURE du protocole doit concorder : « une version majeure
 * différente est refusée avec ETAT_PARTIE_INCOMPATIBLE plutôt que de laisser
 * une partie se dérouler sur deux formats » (ARCHI versionnement_protocole).
 */
function memeVersionMajeure(recue: string, attendue: string): boolean {
  return recue.split('.')[0] === attendue.split('.')[0];
}

export function authentifier(
  depot: Depot,
  charge: unknown,
  versionAttendue: string,
): ResultatAuthentification {
  const valide = CmdAuthentifier.safeParse(charge);
  if (!valide.success) {
    return {
      ok: false,
      code: 'MESSAGE_MALFORME',
      message: 'Charge d’authentification non conforme au schéma.',
    };
  }
  if (!memeVersionMajeure(valide.data.version_protocole, versionAttendue)) {
    return {
      ok: false,
      code: 'ETAT_PARTIE_INCOMPATIBLE',
      message: 'Version de protocole incompatible.',
    };
  }

  const identite = depot.identiteParJeton(hacher(valide.data.jeton_session));
  if (identite === undefined) {
    return { ok: false, code: 'JETON_INVALIDE', message: 'Jeton inconnu ou révoqué.' };
  }
  // Seconde comparaison, à temps constant, sur le condensat retrouvé : la
  // première lecture est un index, celle-ci est la vérification.
  if (!jetonCorrespond(valide.data.jeton_session, hacher(valide.data.jeton_session))) {
    return { ok: false, code: 'JETON_INVALIDE', message: 'Jeton invalide.' };
  }
  return { ok: true, joueur_id: identite.joueur_id, session_id: identite.session_id };
}
