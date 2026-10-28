// Machine à états de partie — machine_etats_partie de la SPEC.
//
// Les transitions admises sont une TABLE. Une transition absente de la table
// n'existe pas : il n'y a pas de chemin détourné pour forcer un état, ce qui
// couvre notamment la seule porte par laquelle l'hôte pourrait provoquer une
// divulgation — l'abandon, qui mène à ABANDONNEE et à rien d'autre (RG-76).

import type { EtatPartie } from '@gdv/partage';

export interface TransitionAdmise {
  readonly de: EtatPartie;
  readonly vers: EtatPartie;
  readonly declencheur: string;
}

const ETATS_TERMINAUX: readonly EtatPartie[] = ['TERMINEE', 'ABANDONNEE'];

export const TRANSITIONS: readonly TransitionAdmise[] = [
  { de: 'CREEE', vers: 'SALLE_ATTENTE', declencheur: 'premier joueur rejoint' },
  { de: 'SALLE_ATTENTE', vers: 'PLACEMENT', declencheur: 'hote.demarrer' },
  { de: 'PLACEMENT', vers: 'DISTRIBUTION', declencheur: 'hote.valider_ordre' },
  { de: 'DISTRIBUTION', vers: 'MANCHE_EN_COURS', declencheur: 'distribution terminée' },
  { de: 'MANCHE_EN_COURS', vers: 'MANCHE_EN_COURS', declencheur: 'manche k clôturée' },
  { de: 'MANCHE_EN_COURS', vers: 'DERNIER_VOEU', declencheur: 'dernière manche, mode avancé' },
  { de: 'MANCHE_EN_COURS', vers: 'SCORES', declencheur: 'dernière manche, mode normal' },
  { de: 'DERNIER_VOEU', vers: 'SCORES', declencheur: 'résolution des signatures' },
  { de: 'SCORES', vers: 'TERMINEE', declencheur: 'automatique' },
  { de: 'CREEE', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'SALLE_ATTENTE', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'PLACEMENT', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'DISTRIBUTION', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'MANCHE_EN_COURS', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'DERNIER_VOEU', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
  { de: 'SCORES', vers: 'ABANDONNEE', declencheur: 'hote.abandonner | inactivite' },
];

export function transitionAdmise(de: EtatPartie, vers: EtatPartie): boolean {
  return TRANSITIONS.some((transition) => transition.de === de && transition.vers === vers);
}

export function estTerminal(etat: EtatPartie): boolean {
  return ETATS_TERMINAUX.includes(etat);
}

/** Le compteur du groupe n'est incrémenté qu'au passage en TERMINEE (RG-59, CA-48). */
export function incrementeLeCompteurDuGroupe(vers: EtatPartie): boolean {
  return vers === 'TERMINEE';
}

export type TransitionPartie = typeof transitionAdmise;
