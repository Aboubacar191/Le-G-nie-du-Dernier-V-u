// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-80, rang 1 du registre. RUP-02.            ║
// ║  CHARGE NEUTRE : ce que reçoit un destinataire qui n'appartient PAS à  ║
// ║  la classe x-visibilite de l'événement.                                ║
// ║  Couverture exigée ici : 100 % des lignes ET des branches.             ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// POURQUOI CE FICHIER EXISTE. Jusqu'à RUP-02, un non-destinataire ne recevait
// RIEN, et cette absence était elle-même l'information : « trames clause_recue
// par joueur = {J0:0, J1:0, J2:0, J3:1, J4:0, J5:1} » livrait exactement
// l'ensemble « porteur ∪ FAISEUR_CONTRATS » sans qu'aucun champ ne fuite
// (ANO-01, bloquante, MESURÉE). Six canaux de ce type étaient ouverts derrière
// neuf portes vertes. Désormais toute trame part à tous, et le non-destinataire
// reçoit la charge neutre déclarée par le schéma.
//
// CONSTRUCTION PAR AJOUT, PAS PAR SOUSTRACTION. Chaque entrée de la table
// ci-dessous ÉCRIT les champs neutres qu'elle a le droit d'écrire. Elle ne part
// JAMAIS de la charge complète pour en retirer les secrets : c'est le mode de
// défaillance que (P-c) nomme « la charge à moitié vidée » — un développeur qui
// supprime les champs un par un laissera le champ ajouté la semaine suivante.
// La table est TOTALE sur les 31 types par le type mappé : un événement ajouté
// au contrat sans charge neutre ne compile pas.
//
// L'ensemble des clés produit ici est confronté mécaniquement à
// x-charge-neutre du contrat (tests/projection/charges-neutres.test.ts, et la
// porte npm run verifier:uniformite / contrôle P-c sur projections réelles).

import {
  CHARGE_NEUTRE_PAR_EVENEMENT,
  EMISSION_PAR_EVENEMENT,
  estCodeErreurDeProtocole,
} from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';

/** `null` = aucune trame ne part vers ce destinataire. `{}` = une trame vide part. */
export type ChargeNeutre = Readonly<Record<string, unknown>> | null;

/** La charge neutre est l'objet VIDE : x-charge-neutre vaut []. */
const VIDE: ChargeNeutre = Object.freeze({});

/**
 * Pas de charge neutre du tout, et deux raisons distinctes :
 *   · x-emission = uniforme_charge_identique — la charge est la même pour tous,
 *     il n'existe aucun non-destinataire et cette entrée est inatteignable ;
 *   · x-emission = exempte — EvtEtatCompletPrive, seule exemption de schéma de
 *     la liste FERMÉE, dont le déclencheur (une reconnexion) est déjà public.
 * Rendre {} ici ferait partir une trame là où rien ne doit partir.
 */
const AUCUNE: ChargeNeutre = null;

/**
 * La seule donnée que le contrat autorise dans une charge neutre est
 * numero_manche, et elle est classée visible_par: tous par matrice_visibilite —
 * la porte U3 le vérifie sur le contrat, indépendamment de ce fichier. Un numéro
 * de manche est connu de toute la table : il ne distingue aucun joueur.
 */
const parManche = (numero_manche: number): ChargeNeutre => Object.freeze({ numero_manche });

type ConstructeurNeutre<T extends Effet['type']> = (effet: Extract<Effet, { type: T }>) => ChargeNeutre;

type TableNeutres = { readonly [T in Effet['type']]: ConstructeurNeutre<T> };

const NEUTRES: TableNeutres = {
  // Sa présence disait « ce joueur a émis une commande dans cette phase ». En
  // ENQUETES_ACCUSATIONS, un joueur qui n'a pas accusé publiquement et qui a
  // néanmoins reçu un accusé a enquêté : c'est exactement le bit de RG-27.
  accuse_reception: () => VIDE,
  // Sa présence disait « ce joueur a TENTÉ un acte et a été refusé » —
  // SOLDE_INSUFFISANT sur une enquête, QUOTA_DEPASSE sur une seconde enquête.
  // Les cinq codes de protocole sont les seuls exemptés : ils décrivent la
  // TRAME, pas un acte de jeu, et les deux premiers surviennent sur un socket
  // anonyme qui n'appartient à aucune session.
  erreur: (effet) => (estCodeErreurDeProtocole(effet.code) ? AUCUNE : VIDE),
  etat_complet_prive: () => AUCUNE,
  etat_partie_change: () => AUCUNE,
  joueur_rejoint: () => AUCUNE,
  joueur_quitte: () => AUCUNE,
  joueur_reconnecte: () => AUCUNE,
  // Classe tous, charge identique pour tous : cette entrée est INATTEIGNABLE,
  // exactement comme joueur_rejoint/joueur_quitte/joueur_reconnecte ci-dessus.
  joueur_pret_change: () => AUCUNE,
  partie_demarree: () => AUCUNE,
  // Chaque joueur en reçoit exactement une à la distribution : le nombre est
  // déjà uniforme. L'entrée existe pour la totalité de la table.
  attribution_privee: () => VIDE,
  voeu_annonce: () => AUCUNE,
  // ANO-01, mesurée : la présence livrait « porteur ∪ FAISEUR_CONTRATS ».
  clause_recue: (effet) => parManche(effet.numero_manche),
  phase_changee: () => AUCUNE,
  declaration_publiee: () => AUCUNE,
  // CONF-12 a refusé toute pastille publique « a payé » au motif que savoir QUI
  // a payé renseigne sur le comportement de la table. La présence de la trame
  // reconstituait ce compteur à l'insu de cet arbitrage.
  paiement_enregistre: (effet) => parManche(effet.numero_manche),
  // Sa présence disait « un transfert a eu lieu ENTRE CES DEUX JOUEURS », ce que
  // matrice_visibilite interdit précisément parce qu'il permet de recouper les
  // soldes.
  transfert_enregistre: () => VIDE,
  // Sa présence disait « un prêt existe », donc que l'un des deux détient le
  // rôle PRETEUR, qui est secret.
  pret_propose: () => VIDE,
  pret_resolu: () => VIDE,
  pret_preleve: () => VIDE,
  revelation_ecart_total: () => AUCUNE,
  // CA-15 : l'événement n'était pas émis quand aucun gabarit n'était éligible.
  // L'absence est la même pour les N joueurs, donc elle ne discrimine personne
  // et relève de RG-81 plus que de RG-80 — elle est fermée ici parce que le coût
  // est nul. La classe est « tous » : cette entrée n'est pas atteinte par un
  // non-destinataire, mais la variante {numero_manche} l'est par le projecteur
  // lui-même quand la révélation est absente.
  revelation: (effet) => parManche(effet.numero_manche),
  // ANO-02, mesurée : seul l'enquêteur la recevait. RG-27 protège le fait MÊME
  // qu'une enquête a eu lieu, pas seulement son résultat.
  resultat_enquete: (effet) => parManche(effet.numero_manche),
  accusation_declaree: () => AUCUNE,
  accusation_resolue: () => AUCUNE,
  execution_resultat: () => AUCUNE,
  // Principal contributeur du profil 28 contre 25 relevé par le QA : n'était
  // émis qu'au joueur dont le solde bougeait, donc disait qu'il avait payé,
  // enquêté, transféré ou reçu.
  solde_mis_a_jour: () => VIDE,
  dernier_voeu_propose: () => VIDE,
  dernier_voeu_resolu: () => AUCUNE,
  scores_finaux: () => AUCUNE,
  partie_abandonnee: () => AUCUNE,
  // Ne révèle QUE l'identité de l'hôte, déjà publique (est_hote) : AUCUNE fuite.
  // Soumis à la règle unique par refus de maintenir une liste d'exceptions, pas
  // par nécessité de sécurité — « une liste à maintenir est une liste qui
  // oublie ».
  groupe_mis_a_jour: () => VIDE,
};

/**
 * Charge destinée à un destinataire HORS CLASSE, ou `null` si aucune trame ne
 * doit partir vers lui.
 *
 * L'exemption est lue dans x-emission, jamais décidée ici : la liste des
 * exceptions est FERMÉE au contrat et y ajouter une ligne est une décision
 * d'architecture. C'est le contrôle U4 de la porte d'uniformité qui confronte
 * les exemptions du CODE à celles du CONTRAT.
 */
export function chargeNeutre(effet: Effet): ChargeNeutre {
  if (EMISSION_PAR_EVENEMENT[effet.type] === 'exempte') return AUCUNE;
  const constructeur = NEUTRES[effet.type] as ConstructeurNeutre<Effet['type']>;
  return constructeur(effet);
}

/** Lecture du contrat, exposée pour le test mécanique d'égalité des clés. */
export { CHARGE_NEUTRE_PAR_EVENEMENT };

export type ChargeNeutreDe = typeof chargeNeutre;
