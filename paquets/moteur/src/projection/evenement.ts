// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// projeterEvenement : UNE charge par destinataire, ou null. Un événement dit
// « public » est une BOUCLE de projections individuelles, chacune recalculée
// pour son destinataire — jamais un objet partagé envoyé N fois (ADR-TL-03).
//
// Trois gardes, dans cet ordre :
//   1. le destinataire appartient-il à la session ? sinon RIEN ;
//   2. le projecteur de l'effet produit-il une charge ? sinon RIEN ;
//   3. le destinataire appartient-il à la CLASSE DÉCLARÉE AU CONTRAT pour cet
//      événement, au vu des propriétaires déclarés par l'effet ? sinon RIEN.
// La classe n'est jamais décidée par le code : elle est lue dans x-visibilite.

import { VISIBILITE_PAR_EVENEMENT } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import type { EtatSession } from '../etat/types.ts';
import {
  projeterAccuseReception,
  projeterAttributionPrivee,
  projeterClauseRecue,
  projeterDernierVoeuPropose,
  projeterErreur,
  projeterEtatCompletPrive,
  projeterGroupeMisAJour,
  projeterPaiementEnregistre,
  projeterPretPreleve,
  projeterPretPropose,
  projeterPretResolu,
  projeterResultatEnquete,
  projeterSoldeMisAJour,
  projeterTransfertEnregistre,
  type ProjectionBrute,
} from './evenements-prives.ts';
import {
  projeterAccusationDeclaree,
  projeterAccusationResolue,
  projeterDeclarationPubliee,
  projeterDernierVoeuResolu,
  projeterEtatPartieChange,
  projeterExecutionResultat,
  projeterJoueurRejoint,
  projeterPartieAbandonnee,
  projeterPartieDemarree,
  projeterPhaseChangee,
  projeterPresence,
  projeterRevelation,
  projeterRevelationEcartTotal,
  projeterVoeuAnnonce,
} from './evenements-publics.ts';
import { appartientALaClasse, estDansLaSession } from './regles-visibilite.ts';
import { projeterScoresFinaux } from './scores-finaux.ts';

/**
 * Table TOTALE sur les 30 types d'événement. Le type mappé exige UNE entrée par
 * type et impose à chaque entrée la variante d'effet correspondante : un
 * événement ajouté au contrat sans projecteur ne compile pas, et un projecteur
 * branché sur le mauvais effet ne compile pas non plus.
 *
 * Une table plutôt qu'un aiguillage à trente branches : l'aiguillage dépassait
 * les seuils de complexité de l'ARCHI, et un relecteur n'y voyait plus si un
 * cas manquait. Ici, c'est le compilateur qui le voit.
 */
type Projecteur<T extends Effet['type']> = (
  etat: EtatSession,
  effet: Extract<Effet, { type: T }>,
  destinataire: string,
) => ProjectionBrute | null;

type TableProjecteurs = { readonly [T in Effet['type']]: Projecteur<T> };

const PROJECTEURS: TableProjecteurs = {
  accuse_reception: (_etat, effet) => projeterAccuseReception(effet),
  erreur: (_etat, effet) => projeterErreur(effet),
  etat_complet_prive: (etat, effet) => projeterEtatCompletPrive(etat, effet),
  etat_partie_change: (etat) => projeterEtatPartieChange(etat),
  joueur_rejoint: (etat, effet, destinataire) => projeterJoueurRejoint(etat, effet, destinataire),
  joueur_quitte: (etat, effet, destinataire) => projeterPresence(etat, effet, destinataire),
  joueur_reconnecte: (etat, effet, destinataire) => projeterPresence(etat, effet, destinataire),
  partie_demarree: (etat) => projeterPartieDemarree(etat),
  attribution_privee: (etat, effet) => projeterAttributionPrivee(etat, effet),
  voeu_annonce: (etat, effet) => projeterVoeuAnnonce(etat, effet),
  clause_recue: (etat, effet, destinataire) => projeterClauseRecue(etat, effet, destinataire),
  phase_changee: (etat) => projeterPhaseChangee(etat),
  declaration_publiee: (etat, effet) => projeterDeclarationPubliee(etat, effet),
  paiement_enregistre: (_etat, effet) => projeterPaiementEnregistre(effet),
  transfert_enregistre: (_etat, effet) => projeterTransfertEnregistre(effet),
  pret_propose: (_etat, effet) => projeterPretPropose(effet),
  pret_resolu: (_etat, effet) => projeterPretResolu(effet),
  pret_preleve: (_etat, effet) => projeterPretPreleve(effet),
  revelation_ecart_total: (etat, effet) => projeterRevelationEcartTotal(etat, effet),
  revelation: (_etat, effet) => projeterRevelation(effet),
  resultat_enquete: (_etat, effet) => projeterResultatEnquete(effet),
  accusation_declaree: (_etat, effet) => projeterAccusationDeclaree(effet),
  accusation_resolue: (_etat, effet) => projeterAccusationResolue(effet),
  execution_resultat: (etat, effet) => projeterExecutionResultat(etat, effet),
  solde_mis_a_jour: (etat, effet) => projeterSoldeMisAJour(etat, effet),
  dernier_voeu_propose: (etat, effet) => projeterDernierVoeuPropose(etat, effet),
  dernier_voeu_resolu: (_etat, effet) => projeterDernierVoeuResolu(effet),
  scores_finaux: (etat) => projeterScoresFinaux(etat),
  partie_abandonnee: (_etat, effet) => projeterPartieAbandonnee(effet),
  groupe_mis_a_jour: (etat, effet) => projeterGroupeMisAJour(etat, effet),
};

function projeterBrut(
  etat: EtatSession,
  effet: Effet,
  destinataire: string,
): ProjectionBrute | null {
  const projecteur = PROJECTEURS[effet.type] as Projecteur<Effet['type']>;
  return projecteur(etat, effet, destinataire);
}

/**
 * Charge projetée pour CE destinataire, ou null s'il n'a rien à recevoir.
 * null n'est pas une erreur : c'est la réponse normale pour un joueur qui n'est
 * pas destinataire de l'effet. Le transport envoie, ou n'envoie pas.
 */
export function projeterEvenement(
  etat: EtatSession,
  effet: Effet,
  destinataire: string,
): Readonly<Record<string, unknown>> | null {
  if (!estDansLaSession(etat, destinataire)) return null;
  const projection = projeterBrut(etat, effet, destinataire);
  if (projection === null) return null;
  const classe = VISIBILITE_PAR_EVENEMENT[effet.type];
  if (!appartientALaClasse(etat, destinataire, classe, projection.proprietaires)) return null;
  return projection.charge;
}

export type ProjeterEvenement = typeof projeterEvenement;
