// Commandes réservées à l'hôte : démarrage, ordre des places, avance de phase,
// abandon. L'autorisation est vérifiée ICI, dans la couche pure : un client
// modifié n'obtient aucun effet interdit (RG-71).

import type { Effet } from '../etat/effets.ts';
import { estHote, joueursConnectes } from '../etat/acces.ts';
import { distribuer } from '../distribution/index.ts';
import { abandonner } from '../machine/fin-de-partie.ts';
import { avancerDUnePhase, ecritureDe, ouvrirManche } from '../machine/flux.ts';
import type { ContexteMoteur, EtatSession } from '../etat/types.ts';
import { auteurDe, booleenDe, listeTexteDe, refus, succes, type ResultatCommande } from './resultat.ts';

const PREMIERE_MANCHE = 1;
const PREMIERE_POSITION = 1;

function exigerHote(
  etat: EtatSession,
  contexte: ContexteMoteur,
): ResultatCommande | null {
  if (estHote(etat, auteurDe(contexte))) return null;
  return refus(
    etat,
    'ACTION_RESERVEE_HOTE',
    'Cette commande est réservée à l’hôte de la session.',
  );
}

/** CA-02 : démarrage refusé hors de [joueurs_min, joueurs_max]. */
export function demarrerPartie(
  etat: EtatSession,
  _charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const nonHote = exigerHote(etat, contexte);
  if (nonHote !== null) return nonHote;
  if (etat.etat_partie !== 'SALLE_ATTENTE') {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'La partie n’est pas en salle d’attente.');
  }
  const connectes = joueursConnectes(etat).length;
  if (connectes < etat.config.joueurs_min || connectes > etat.config.joueurs_max) {
    return refus(etat, 'EFFECTIF_INSUFFISANT', 'L’effectif connecté n’autorise pas le démarrage.', {
      connectes,
      minimum: etat.config.joueurs_min,
      maximum: etat.config.joueurs_max,
    });
  }
  return succes({ ...etat, etat_partie: 'PLACEMENT' }, [{ type: 'etat_partie_change' }]);
}

/** CA-04 : l'ordre est une permutation COMPLÈTE et UNIQUE des joueurs (RG-06). */
function ordreValide(etat: EtatSession, ordre: readonly string[]): boolean {
  if (ordre.length !== etat.joueurs.length) return false;
  if (new Set(ordre).size !== ordre.length) return false;
  const connus = new Set(etat.joueurs.map((joueur) => joueur.id));
  return ordre.every((id) => connus.has(id));
}

export function definirOrdrePlaces(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const nonHote = exigerHote(etat, contexte);
  if (nonHote !== null) return nonHote;
  if (etat.etat_partie !== 'PLACEMENT') {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'La session n’est pas en phase de placement.');
  }
  const ordre = listeTexteDe(charge, 'ordre');
  if (ordre === null || !ordreValide(etat, ordre)) {
    return refus(
      etat,
      'ORDRE_PLACES_INVALIDE',
      'L’ordre des places doit être une permutation complète et unique des joueurs.',
    );
  }

  const place: EtatSession = {
    ...etat,
    etat_partie: 'DISTRIBUTION',
    joueurs: etat.joueurs.map((joueur) => ({
      ...joueur,
      position_cercle: ordre.indexOf(joueur.id) + PREMIERE_POSITION,
    })),
  };

  const distribue = distribuer(place, contexte.alea, ecritureDe(contexte));
  const attributions: Effet[] = distribue.joueurs.map((joueur) => ({
    type: 'attribution_privee',
    joueur_id: joueur.id,
  }));
  const soldes: Effet[] = distribue.joueurs.map((joueur) => ({
    type: 'solde_mis_a_jour',
    joueur_id: joueur.id,
  }));
  const premiere = ouvrirManche(distribue, PREMIERE_MANCHE, contexte);

  return succes(premiere.etat, [
    { type: 'etat_partie_change' },
    { type: 'partie_demarree' },
    ...attributions,
    ...soldes,
    ...premiere.effets,
  ]);
}

/** SEULE accélération du temps, et uniquement en NEGOCIATION (RG-72). */
export function avancerPhase(
  etat: EtatSession,
  _charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const nonHote = exigerHote(etat, contexte);
  if (nonHote !== null) return nonHote;
  if (etat.phase !== 'NEGOCIATION') {
    return refus(etat, 'ACTION_HORS_PHASE', 'L’avance de phase n’est possible qu’en négociation.');
  }
  const transition = avancerDUnePhase(etat, contexte);
  if (transition === null) {
    return refus(etat, 'ACTION_HORS_PHASE', 'Aucune phase suivante.');
  }
  return succes(transition.etat, transition.effets);
}

/** Terminal et irréversible. Le compteur du groupe N'EST PAS incrémenté (RG-59). */
export function abandonnerPartie(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const nonHote = exigerHote(etat, contexte);
  if (nonHote !== null) return nonHote;
  if (booleenDe(charge, 'confirmation') !== true) {
    return refus(
      etat,
      'MESSAGE_MALFORME',
      'L’abandon exige une confirmation explicite.',
    );
  }
  if (etat.etat_partie === 'TERMINEE' || etat.etat_partie === 'ABANDONNEE') {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'La partie est déjà terminée.');
  }
  const transition = abandonner(etat, 'ABANDON_HOTE', contexte);
  return succes(transition.etat, transition.effets);
}
