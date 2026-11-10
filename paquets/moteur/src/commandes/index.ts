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
import { signalerPret } from './salle-attente.ts';
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
  signaler_pret: signalerPret,
};

/** Commandes dont l'autorisation dépend de la PHASE, dérivées de la table. */
const COMMANDES_PHASEES: ReadonlySet<string> = new Set(
  Object.values(ACTIONS_PAR_PHASE).flat(),
);

/**
 * ANO-13 — GARDE SUR LE TYPE, et pas seulement sur la charge.
 *
 * Le transport barre déjà les types inconnus par SchemaEnveloppeCommande, si
 * bien que ce chemin n'est pas atteignable depuis le réseau. Il l'était depuis
 * le moteur : un type inventé passait par GESTIONNAIRES[type], qui valait
 * undefined, et l'appel levait « GESTIONNAIRES[type] is not a function ». Or
 * ARCHI/conventions.gestion_erreurs est explicite — « un refus est une erreur
 * TYPÉE rendue dans le Resultat, jamais une exception » — et commandes/
 * resultat.ts revendique une défense en profondeur qui ne couvrait en réalité
 * que la charge. Une exception non typée qui franchit une frontière de couche
 * ressort en ERREUR_INTERNE, c'est-à-dire en incident, là où le refus est une
 * décision.
 *
 * La vérification porte sur la PRÉSENCE DE LA CLÉ dans la table, et non sur une
 * liste de types recopiée : la table est la seule source, et un gestionnaire
 * ajouté demain est couvert sans que personne y pense.
 */
function gestionnaireDe(type: TypeCommande): GestionnaireCommande | undefined {
  if (!Object.prototype.hasOwnProperty.call(GESTIONNAIRES, type)) return undefined;
  return GESTIONNAIRES[type as CommandeDeJeu];
}

/**
 * Refus décidés AVANT tout gestionnaire : type, identité, état de partie,
 * phase. Extraits dans leur propre fonction pour que l'ajout de la garde de
 * ANO-13 ne fasse pas franchir à appliquerCommande le seuil de complexité
 * cyclomatique de 10 fixé par l'ARCHI — le seuil n'est pas négociable, c'est
 * donc le découpage qui bouge.
 *
 * L'ORDRE est délibéré : un type inconnu est rejeté avant qu'on ne cherche un
 * auteur, et l'usurpation est rejetée avant toute considération de phase, parce
 * qu'elle est journalisée comme incident de sécurité (CA-44).
 */
function refusPrealable(
  etat: EtatSession,
  type: TypeCommande,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande | null {
  if (type === 'authentifier') {
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
  return null;
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
  const prealable = refusPrealable(etat, type, charge, contexte);
  if (prealable !== null) return prealable;

  // ANO-13 : la table est interrogée, puis le résultat est CONTRÔLÉ. L'accès
  // indexé rendait undefined pour un type inventé et l'appel levait
  // « GESTIONNAIRES[type] is not a function » — une exception non typée qui
  // franchit la frontière de couche, là où l'ARCHI exige une erreur typée dans
  // le Resultat. Le contrôle porte sur la TABLE, seule source : un gestionnaire
  // ajouté demain est couvert sans que personne y pense.
  const gestionnaire = gestionnaireDe(type);
  if (gestionnaire === undefined) {
    // API / x-temps-reel.enveloppe.type_inconnu : « Rejeté avec
    // COMMANDE_INCONNUE. Le serveur n'ignore jamais silencieusement une trame. »
    return refus(etat, 'COMMANDE_INCONNUE', 'Type de commande inconnu.');
  }

  const resultat = gestionnaire(etat, charge, contexte);
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
