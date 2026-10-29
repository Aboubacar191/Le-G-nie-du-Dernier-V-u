// Application des événements PUBLICS de manche.
//
// Tout ce qui est appliqué ici est visible par toute la table
// (matrice_visibilite : visible_par « tous »). Aucun de ces champs n'alimente un
// voile, et aucun ne doit jamais porter un montant payé.

import type {
  ChargeAccusationDeclaree,
  ChargeAccusationResolue,
  ChargeDeclarationPubliee,
  ChargeDernierVoeuResolu,
  ChargeExecutionResultat,
  ChargePhaseChangee,
  ChargeRevelation,
  ChargeRevelationEcartTotal,
  ChargeVoeuAnnonce,
} from '@gdv/partage';

import type { EtatLocal } from './etat.ts';
import type { Applicateur } from './reducteurs-session.ts';
import { reinitialiserManche } from './reducteurs-session.ts';

function appliquerPhase(etat: EtatLocal, charge: unknown): void {
  const evenement = charge as ChargePhaseChangee;
  if (etat.numero_manche !== null && evenement.numero_manche !== etat.numero_manche) {
    reinitialiserManche(etat);
  }
  etat.phase = evenement.phase;
  etat.phase_fin_at = evenement.phase_fin_at;
  etat.numero_manche = evenement.numero_manche;
  etat.actions_autorisees = evenement.actions_autorisees;
  // M3 : le changement de phase remasque tout secret affiché. Le voile se
  // réinitialise par la clé de rendu de l'écran, qui dépend de la phase.
  etat.alerte = null;
}

function appliquerExecution(etat: EtatLocal, charge: unknown): void {
  const resultat = charge as ChargeExecutionResultat;
  etat.execution = resultat;
  // La clause est révélée ici, SANS son porteur : aucune carte n'est marquée,
  // aucun ordre d'affichage ne dépend du porteur (matrice_visibilite —
  // l'identité du porteur ne devient publique JAMAIS en v1).
}

export const APPLICATEURS_MANCHE: Readonly<Record<string, Applicateur>> = Object.freeze({
  phase_changee: appliquerPhase,

  voeu_annonce: (etat, charge) => {
    const evenement = charge as ChargeVoeuAnnonce;
    etat.voeu = evenement;
    etat.numero_manche = evenement.numero_manche;
  },

  declaration_publiee: (etat, charge) => {
    const evenement = charge as ChargeDeclarationPubliee;
    // RG-31 : la déclaration est une ANNONCE, publiée à tous dès la soumission.
    // Elle s'affiche en clair, sans voile : c'est le contraste pédagogique qui
    // apprend au joueur que ce qui est voilé est secret.
    etat.declarations = {
      ...etat.declarations,
      [evenement.joueur_id]: evenement.montant_declare,
    };
    etat.nb_declarations = evenement.nb_declarations;
  },

  revelation_ecart_total: (etat, charge) => {
    etat.ecart_total = charge as ChargeRevelationEcartTotal;
  },

  revelation: (etat, charge) => {
    // L'événement ne porte AUCUN texte (ADR-TL-12) : le client compose la
    // phrase depuis contenu/revelations.fr.json.
    etat.revelation = charge as ChargeRevelation;
  },

  accusation_declaree: (etat, charge) => {
    const evenement = charge as ChargeAccusationDeclaree;
    etat.accusations = [
      ...etat.accusations,
      {
        accusation_id: evenement.accusation_id,
        accusateur_joueur_id: evenement.accusateur_joueur_id,
        accuse_joueur_id: evenement.accuse_joueur_id,
        numero_manche: evenement.numero_manche,
        verdict: null,
      },
    ];
  },

  accusation_resolue: (etat, charge) => {
    const evenement = charge as ChargeAccusationResolue;
    // Le verdict est public immédiatement ; l'AMPLEUR du mensonge ne l'est pas
    // avant l'EXECUTION (ADR-CP-06). La carte affiche donc le mot, sans chiffre.
    etat.accusations = etat.accusations.map((accusation) =>
      accusation.accusation_id === evenement.accusation_id
        ? { ...accusation, verdict: evenement.verdict }
        : accusation,
    );
  },

  execution_resultat: appliquerExecution,

  dernier_voeu_resolu: (etat, charge) => {
    // RG-53 : le NOMBRE de signataires est public, les IDENTITÉS ne le sont
    // qu'à l'écran des scores (RG-54).
    etat.dernier_voeu_resolu = charge as ChargeDernierVoeuResolu;
  },
});
