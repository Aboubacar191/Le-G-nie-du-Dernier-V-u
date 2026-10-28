// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Une seule porte décide de l'appartenance à une classe de destinataire. La
// CLASSE vient du contrat (x-visibilite, lu par @gdv/partage) ; la liste des
// PROPRIÉTAIRES vient de l'effet. Aucun projecteur ne décide seul qui a le
// droit de recevoir : il déclare les propriétaires, et cette fonction tranche.

import type { ClasseDestinataire } from '@gdv/partage';

import { trouverJoueur } from '../etat/acces.ts';
import type { EtatSession } from '../etat/types.ts';

const ROLE_FAISEUR_CONTRATS = 'FAISEUR_CONTRATS';

export function estDansLaSession(etat: EtatSession, destinataire: string): boolean {
  return trouverJoueur(etat, destinataire) !== undefined;
}

export function estHoteDeLaSession(etat: EtatSession, destinataire: string): boolean {
  return trouverJoueur(etat, destinataire)?.est_hote === true;
}

/**
 * RG-18 / CA-12 : la clause va au porteur tiré au sort ET à tout
 * FAISEUR_CONTRATS, et à personne d'autre. L'identité du porteur n'est révélée
 * à personne, jamais : le message ne dit pas QUI porte la clause.
 */
export function destinatairesDeLaClause(
  etat: EtatSession,
  porteurJoueurId: string,
): readonly string[] {
  const faiseurs = etat.joueurs
    .filter((joueur) => joueur.role_secret === ROLE_FAISEUR_CONTRATS)
    .map((joueur) => joueur.id);
  return [...new Set([porteurJoueurId, ...faiseurs])];
}

/** Le destinataire appartient-il à la classe autorisée, dans cet état ? */
export function appartientALaClasse(
  etat: EtatSession,
  destinataire: string,
  classe: ClasseDestinataire,
  proprietaires: readonly string[],
): boolean {
  switch (classe) {
    case 'tous':
      return estDansLaSession(etat, destinataire);
    case 'hote':
      return estHoteDeLaSession(etat, destinataire);
    case 'proprietaire':
    case 'enqueteur':
    case 'porteur_clause_et_faiseur':
      return proprietaires.includes(destinataire);
  }
}

export type AppartientALaClasse = typeof appartientALaClasse;
