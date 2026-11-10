// Commande signaler_pret : statut « prêt » de la salle d'attente (écran 1b).
//
// PAS réservée à l'hôte, à la différence de demarrer_partie / abandonner_partie
// (hote.ts) : N'IMPORTE QUEL joueur connecté bascule SON PROPRE statut, à tout
// moment pendant SALLE_ATTENTE. Purement informatif : AUCUNE incidence sur la
// garde de demarrer_partie, qui reste gouvernée uniquement par
// [joueurs_min, joueurs_max] (RG-02, CA-02) — aucune condition n'est ajoutée
// ici ni là-bas.
//
// Aucune usurpation possible PAR CONSTRUCTION : la charge ne porte aucun champ
// de cible (contrairement à transferer_pieces, lancer_enquete, etc.), donc rien
// ne permet de désigner un autre joueur que l'auteur déduit de la connexion
// authentifiée (CA-44).

import { avecJoueur, trouverJoueur } from '../etat/acces.ts';
import type { ContexteMoteur, EtatSession } from '../etat/types.ts';
import { auteurDe, booleenDe, refus, succes, type ResultatCommande } from './resultat.ts';

/** RG-02, CA-02 : SALLE_ATTENTE seule. Joueur connecté seul. Aucune autre garde. */
export function signalerPret(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  if (etat.etat_partie !== 'SALLE_ATTENTE') {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'Le statut prêt n’existe qu’en salle d’attente.');
  }
  const auteur = auteurDe(contexte);
  const joueur = trouverJoueur(etat, auteur);
  if (joueur === undefined || !joueur.connecte) {
    return refus(
      etat,
      'ETAT_PARTIE_INCOMPATIBLE',
      'Seul un joueur connecté peut signaler son statut.',
    );
  }
  const pret = booleenDe(charge, 'pret');
  if (pret === null) {
    return refus(etat, 'MESSAGE_MALFORME', 'signaler_pret exige un booléen pret.');
  }
  const mis = avecJoueur(etat, { ...joueur, pret });
  return succes(mis, [{ type: 'joueur_pret_change', joueur_id: auteur, pret }]);
}
