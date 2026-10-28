// Accès à l'état : lectures nommées, sans logique de jeu.
//
// noUncheckedIndexedAccess est actif : toute lecture indexée rend `| undefined`.
// Plutôt que de parsemer le moteur de `?? valeurDeSecours` — qui masquent un
// défaut de programmation derrière une valeur plausible — les accès obligatoires
// passent par des fonctions qui ÉCHOUENT bruyamment. Une exception dans le
// moteur est un défaut de programmation, pas un refus métier
// (ARCHI conventions.gestion_erreurs).

import type { Contribution, EtatSession, Joueur, Manche } from './types.ts';

/** Un cercle n'a de voisinage qu'à partir de deux joueurs (RG-06). */
const TAILLE_MINIMALE_CERCLE = 2;

export function trouverJoueur(etat: EtatSession, joueurId: string): Joueur | undefined {
  return etat.joueurs.find((joueur) => joueur.id === joueurId);
}

export function exigerJoueur(etat: EtatSession, joueurId: string): Joueur {
  const joueur = trouverJoueur(etat, joueurId);
  if (joueur === undefined) {
    throw new Error(`Joueur inconnu dans la session : ${joueurId}`);
  }
  return joueur;
}

export function mancheCourante(etat: EtatSession): Manche | undefined {
  return etat.manches.find((manche) => manche.numero === etat.manche_courante);
}

export function exigerMancheCourante(etat: EtatSession): Manche {
  const manche = mancheCourante(etat);
  if (manche === undefined) {
    throw new Error(`Aucune manche ouverte (manche_courante = ${etat.manche_courante})`);
  }
  return manche;
}

export function contributionDe(manche: Manche, joueurId: string): Contribution | undefined {
  return manche.contributions.find((contribution) => contribution.joueur_id === joueurId);
}

/** Contribution matérialisée : une non-soumission vaut 0 déclaré / 0 payé (RG-32). */
export function declareDe(manche: Manche, joueurId: string): number {
  return contributionDe(manche, joueurId)?.montant_declare ?? 0;
}

export function payeDe(manche: Manche, joueurId: string): number {
  return contributionDe(manche, joueurId)?.montant_paye ?? 0;
}

export function estHote(etat: EtatSession, joueurId: string): boolean {
  return trouverJoueur(etat, joueurId)?.est_hote === true;
}

export function joueursConnectes(etat: EtatSession): readonly Joueur[] {
  return etat.joueurs.filter((joueur) => joueur.connecte);
}

/** Remplace un joueur par sa version modifiée, sans toucher à l'ordre d'arrivée. */
export function avecJoueur(etat: EtatSession, joueur: Joueur): EtatSession {
  return {
    ...etat,
    joueurs: etat.joueurs.map((existant) => (existant.id === joueur.id ? joueur : existant)),
  };
}

/** Remplace la manche de même numéro. */
export function avecManche(etat: EtatSession, manche: Manche): EtatSession {
  return {
    ...etat,
    manches: etat.manches.map((existante) =>
      existante.numero === manche.numero ? manche : existante,
    ),
  };
}

export function manchePar(etat: EtatSession, numero: number): Manche | undefined {
  return etat.manches.find((manche) => manche.numero === numero);
}

/** Ordre du cercle, croissant par position. Vide avant la phase PLACEMENT. */
export function ordreCercle(etat: EtatSession): readonly Joueur[] {
  return etat.joueurs
    .filter((joueur) => joueur.position_cercle !== null)
    .slice()
    .sort((a, b) => (a.position_cercle ?? 0) - (b.position_cercle ?? 0));
}

/** Voisins cycliques d'un joueur dans le cercle (RG-06 : le dernier voisine le premier). */
export function voisinsDe(etat: EtatSession, joueurId: string): readonly string[] {
  const cercle = ordreCercle(etat);
  const index = cercle.findIndex((joueur) => joueur.id === joueurId);
  if (index < 0 || cercle.length < TAILLE_MINIMALE_CERCLE) return [];
  const avant = cercle[(index - 1 + cercle.length) % cercle.length];
  const apres = cercle[(index + 1) % cercle.length];
  const identifiants = [avant?.id, apres?.id].filter((id): id is string => id !== undefined);
  return [...new Set(identifiants)];
}

export function mouvementsDe(etat: EtatSession, joueurId: string): readonly EtatSession['mouvements'][number][] {
  return etat.mouvements.filter((mouvement) => mouvement.joueur_id === joueurId);
}
