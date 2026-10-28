// LOI 1 DU GÉNIE — RG-20 : revérification INDÉPENDANTE de la véracité.
//
// « Une révélation n'est émise que si son énoncé est vérifié vrai contre les
//   paiements réels enregistrés. Le serveur ne peut structurellement pas émettre
//   d'énoncé non vérifié. »
//
// CE MODULE NE PARTAGE AUCUN CODE AVEC LE SÉLECTEUR, et c'est sa raison d'être :
// un vérificateur qui réutilise les fonctions d'éligibilité ne vérifie rien, il
// répète. Il n'importe donc ni eligibilite.ts, ni selection.ts, ni suspects.ts,
// ni les accesseurs de l'état : il relit les contributions brutes de la manche
// et recalcule tout, y compris la matérialisation à 0 d'une non-soumission
// (RG-32) et l'ordre du cercle (RG-06).
// Un test mécanique vérifie cette absence d'import (tests/revelations).

import type { Gabarit } from '@gdv/partage';

import type { EtatSession, Manche } from '../etat/types.ts';

/** Un cercle n'a de voisinage qu'à partir de deux joueurs (RG-06). */
const TAILLE_MINIMALE_CERCLE = 2;

interface EnonceAVerifier {
  readonly gabarit: Gabarit;
  readonly cibles: readonly string[];
  readonly valeurs: Readonly<Record<string, number>>;
}

/** Relecture brute : montant déclaré et montant payé, non soumis valant 0. */
function lire(manche: Manche, joueurId: string): { declare: number; paye: number } {
  let declare = 0;
  let paye = 0;
  for (const contribution of manche.contributions) {
    if (contribution.joueur_id !== joueurId) continue;
    declare = contribution.montant_declare;
    paye = contribution.montant_paye === null ? 0 : contribution.montant_paye;
  }
  return { declare, paye };
}

function aMenti(manche: Manche, joueurId: string): boolean {
  const { declare, paye } = lire(manche, joueurId);
  return declare - paye > 0;
}

function identifiants(etat: EtatSession): readonly string[] {
  return etat.joueurs.map((joueur) => joueur.id);
}

/** Ordre des places relu depuis les positions, indépendamment des accesseurs. */
function cercle(etat: EtatSession): readonly string[] {
  return etat.joueurs
    .filter((joueur) => joueur.position_cercle !== null)
    .slice()
    .sort((a, b) => Number(a.position_cercle) - Number(b.position_cercle))
    .map((joueur) => joueur.id);
}

function voisinsAMenti(etat: EtatSession, manche: Manche, cible: string): boolean {
  const places = cercle(etat);
  const index = places.indexOf(cible);
  if (index < 0 || places.length < TAILLE_MINIMALE_CERCLE) return false;
  const avant = places[(index - 1 + places.length) % places.length];
  const apres = places[(index + 1) % places.length];
  const voisins = [avant, apres].filter((id): id is string => id !== undefined);
  return voisins.some((id) => id !== cible && aMenti(manche, id));
}

function verifierComptage(etat: EtatSession, manche: Manche, enonce: EnonceAVerifier): boolean {
  const attendu = enonce.valeurs.k;
  if (typeof attendu !== 'number') return false;
  const reel = identifiants(etat).filter((id) => aMenti(manche, id)).length;
  return reel === attendu;
}

function verifierComparaison(manche: Manche, enonce: EnonceAVerifier): boolean {
  const [a, b] = enonce.cibles;
  if (a === undefined || b === undefined || a === b) return false;
  return lire(manche, a).paye > lire(manche, b).paye;
}

function verifierPasse(etat: EtatSession, numero: number): boolean {
  const manches = etat.manches.filter((manche) => manche.numero <= numero);
  if (manches.length === 0) return false;
  return identifiants(etat).some((id) => manches.every((manche) => aMenti(manche, id)));
}

function verifierCible(
  etat: EtatSession,
  enonce: EnonceAVerifier,
  predicat: (cible: string) => boolean,
): boolean {
  const [cible] = enonce.cibles;
  if (cible === undefined) return false;
  if (!identifiants(etat).includes(cible)) return false;
  return predicat(cible);
}

/**
 * Vrai si et seulement si l'énoncé est VRAI contre les paiements enregistrés.
 * ECART_TOTAL est vérifié sur ses deux valeurs publiées ; il est émis
 * systématiquement, mais sa véracité n'en est pas moins vérifiée.
 */
export function verifierEnonce(
  etat: EtatSession,
  manche: Manche,
  enonce: EnonceAVerifier,
): boolean {
  switch (enonce.gabarit) {
    case 'ECART_TOTAL': {
      let declare = 0;
      let paye = 0;
      for (const id of identifiants(etat)) {
        const lu = lire(manche, id);
        declare += lu.declare;
        paye += lu.paye;
      }
      return enonce.valeurs.total_declare === declare && enonce.valeurs.total_paye === paye;
    }
    case 'COMPTAGE':
      return verifierComptage(etat, manche, enonce);
    case 'VOISINAGE':
      return verifierCible(etat, enonce, (cible) => voisinsAMenti(etat, manche, cible));
    case 'EXONERATION':
      return verifierCible(etat, enonce, (cible) => !aMenti(manche, cible));
    case 'COMPARAISON':
      return verifierComparaison(manche, enonce);
    case 'PASSE':
      return verifierPasse(etat, manche.numero);
  }
}
