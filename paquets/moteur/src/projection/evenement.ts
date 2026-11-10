// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// projeterEvenement : UNE charge par destinataire. Un événement est TOUJOURS une
// BOUCLE de projections individuelles, chacune recalculée pour son destinataire
// — jamais un objet partagé envoyé N fois (ADR-TL-03). Si une seule charge était
// sérialisée puis envoyée N fois, le premier événement de classe proprietaire
// fuiterait vers les sept autres joueurs.
//
// RUPTURE RUP-02 (RG-80, rang 1). Un non-destinataire ne reçoit plus RIEN : il
// reçoit la CHARGE NEUTRE déclarée par le schéma. L'absence de trame était
// elle-même l'information — « trames resultat_enquete par joueur = {J3:1,
// autres 0} » livrait l'enquêteur en violation de RG-27 sans qu'aucun champ ne
// fuite (ANO-02, bloquante, mesurée). x-visibilite gouverne CE QUE contient une
// trame ; x-emission gouverne À QUI elle part. L'adressage sélectif ÉTAIT le
// canal ; le contenu sélectif est la règle. On garde le second, on supprime le
// premier.
//
// Trois gardes, dans cet ordre :
//   1. le destinataire appartient-il à la session ? sinon RIEN ;
//   2. le projecteur de l'effet produit-il une charge ? sinon RIEN — un effet
//      inapplicable à l'état courant n'est pas une question de destinataire, et
//      il n'est émis à PERSONNE, donc le dénombrement reste égal ;
//   3. le destinataire appartient-il à la CLASSE DÉCLARÉE AU CONTRAT pour cet
//      événement ? si oui, la charge complète ; SINON, la charge neutre.
// Ni la classe ni l'exemption ne sont décidées par le code : elles sont lues
// dans x-visibilite et x-emission.

import { VISIBILITE_PAR_EVENEMENT } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import type { EtatSession } from '../etat/types.ts';
import { chargeNeutre } from './charges-neutres.ts';
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
  projeterJoueurPretChange,
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
 * Table TOTALE sur les 31 types d'événement. Le type mappé exige UNE entrée par
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
  joueur_rejoint: (etat, effet) => projeterJoueurRejoint(etat, effet),
  joueur_quitte: (etat, effet) => projeterPresence(etat, effet),
  joueur_reconnecte: (etat, effet) => projeterPresence(etat, effet),
  joueur_pret_change: (etat, effet) => projeterJoueurPretChange(etat, effet),
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
  pret_preleve: (_etat, effet, destinataire) => projeterPretPreleve(effet, destinataire),
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
 * Charge projetée pour CE destinataire : la charge COMPLÈTE s'il appartient à la
 * classe déclarée, la charge NEUTRE sinon, `null` si aucune trame ne doit partir
 * vers lui.
 *
 * `null` reste possible et ne se confond pas avec la charge vide `{}`. Trois cas
 * seulement le produisent, et aucun des trois ne dépend d'un SECRET :
 *   · le destinataire n'appartient pas à la session ;
 *   · l'effet est inapplicable à l'état courant — personne ne le reçoit, donc
 *     le dénombrement reste égal entre les N joueurs ;
 *   · l'événement est EXEMPTÉ par la liste fermée du contrat : etat_complet_prive
 *     (déclenché par une reconnexion, laquelle est déjà publique) et les cinq
 *     codes d'erreur de protocole.
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
  if (appartientALaClasse(etat, destinataire, classe, projection.proprietaires)) {
    return projection.charge;
  }
  return chargeNeutre(effet);
}

export type ProjeterEvenement = typeof projeterEvenement;
