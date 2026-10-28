// Une fonction PURE par commande client, autorisation incluse (phase, rôle,
// solde, quota). L'autorisation est exclusivement serveur (RG-71) et elle est
// calculée ICI, dans la couche pure : un client modifié n'obtient aucun effet
// interdit.
//
// Le contrôle de phase n'est pas répété commande par commande : il est DÉRIVÉ
// de ACTIONS_PAR_PHASE, la même table que celle annoncée au client dans
// EvtPhaseChangee.actions_autorisees. Une seule table, donc aucune divergence
// possible entre ce que le client affiche et ce que le serveur accepte.

import { pretendDesignerUnAuteur, type TypeCommande } from '@gdv/partage';

import { ACTIONS_PAR_PHASE, autoriseeEnPhase } from '../machine/manche.ts';
import { avancerDUnePhase } from '../machine/flux.ts';
import type { ContexteMoteur, EtatSession } from '../etat/types.ts';
import { estTerminal } from '../machine/partie.ts';
import {
  abandonnerPartie,
  avancerPhase,
  definirOrdrePlaces,
  demarrerPartie,
} from './hote.ts';
import { proposerPret, repondrePret, transfererPieces } from './negociation.ts';
import { declarerContribution, payerSecret, tousOntDeclareEtPaye } from './declaration.ts';
import { accuser, lancerEnquete } from './enquetes.ts';
import { signerDernierVoeu } from './dernier-voeu.ts';
import { auteurDe, refus, succes, type ResultatCommande } from './resultat.ts';

export * from './resultat.ts';
export { coutEnqueteDe } from './enquetes.ts';
export { tousOntDeclareEtPaye } from './declaration.ts';

export type GestionnaireCommande = (
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
) => ResultatCommande;

export type CommandeDeJeu = Exclude<TypeCommande, 'authentifier'>;

export const GESTIONNAIRES: Readonly<Record<CommandeDeJeu, GestionnaireCommande>> = {
  definir_ordre_places: definirOrdrePlaces,
  demarrer_partie: demarrerPartie,
  avancer_phase: avancerPhase,
  transferer_pieces: transfererPieces,
  proposer_pret: proposerPret,
  repondre_pret: repondrePret,
  declarer_contribution: declarerContribution,
  payer_secret: payerSecret,
  lancer_enquete: lancerEnquete,
  accuser: accuser,
  signer_dernier_voeu: signerDernierVoeu,
  abandonner_partie: abandonnerPartie,
};

/** Commandes dont l'autorisation dépend de la PHASE, dérivées de la table. */
const COMMANDES_PHASEES: ReadonlySet<string> = new Set(
  Object.values(ACTIONS_PAR_PHASE).flat(),
);

function estCommandeDeJeu(type: TypeCommande): type is CommandeDeJeu {
  return type !== 'authentifier';
}

/**
 * Applique une commande. Aucune erreur ne modifie l'état : le moteur retourne
 * l'état d'entrée inchangé (CA-43).
 */
export function appliquerCommande(
  etat: EtatSession,
  type: TypeCommande,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  if (!estCommandeDeJeu(type)) {
    return refus(
      etat,
      'MESSAGE_MALFORME',
      'authentifier n’est pas une commande de jeu : elle est obligatoirement la ' +
        'première trame de la connexion et relève du transport.',
    );
  }
  if (pretendDesignerUnAuteur(charge, auteurDe(contexte))) {
    return refus(
      etat,
      'USURPATION_IDENTITE',
      'La charge prétend agir au nom d’un autre joueur (CA-44).',
    );
  }
  if (estTerminal(etat.etat_partie)) {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'La partie est terminée.');
  }
  if (COMMANDES_PHASEES.has(type) && !autoriseeEnPhase(etat.phase, type)) {
    return refus(etat, 'ACTION_HORS_PHASE', 'Cette commande n’est pas ouverte dans cette phase.', {
      phase_courante: etat.phase,
    });
  }

  const resultat = GESTIONNAIRES[type](etat, charge, contexte);
  if (!resultat.ok) return resultat;
  if (type !== 'payer_secret') return resultat;

  // CA-49 : la phase se termine par anticipation dès que TOUS ont déclaré ET
  // payé — sans attendre la fin du minuteur.
  if (!tousOntDeclareEtPaye(resultat.etat)) return resultat;
  const avance = avancerDUnePhase(resultat.etat, contexte);
  if (avance === null) return resultat;
  return succes(avance.etat, [...resultat.effets, ...avance.effets]);
}

export type GestionnairesParCommande = typeof GESTIONNAIRES;
