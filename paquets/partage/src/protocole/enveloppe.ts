// Enveloppes du canal temps réel (API-GDV-001 / x-temps-reel.enveloppe).
//
// L'enveloppe entrante est validée par un objet STRICT, comme toute charge :
// une enveloppe qui porterait un champ supplémentaire — par exemple un
// joueur_id d'auteur — doit être REFUSÉE, pas dépouillée. Dépouiller
// transformerait une tentative d'usurpation en trame valide, et le serveur
// n'aurait plus rien à détecter (CA-44).

import { z } from 'zod';

import type { CorrelationId, HorodatageIso } from '../domaine/identifiants.ts';
import { TYPES_COMMANDE, type TypeCommande } from './commandes-types.ts';
import type { TypeEvenement } from './evenements-types.ts';

/**
 * Client → serveur. Ne porte AUCUN identifiant d'auteur : l'émetteur est déduit
 * de la connexion authentifiée. Un champ qui prétendrait désigner un autre
 * joueur comme auteur doit être rejeté avec USURPATION_IDENTITE (CA-44).
 */
export interface EnveloppeCommande {
  readonly id_correlation: CorrelationId;
  readonly type: TypeCommande;
  readonly charge: Readonly<Record<string, unknown>>;
}

/**
 * Serveur → client. Produite par projeterEvenement(etat, effet, destinataire) :
 * une enveloppe PAR DESTINATAIRE, jamais un objet partagé envoyé N fois (RG-01).
 * `sequence` est monotone par destinataire et repart à 1 après etat_complet_prive.
 */
export interface EnveloppeEvenement {
  readonly type: TypeEvenement;
  readonly sequence: number;
  readonly emis_a: HorodatageIso;
  readonly id_correlation?: CorrelationId | null;
  readonly charge: Readonly<Record<string, unknown>>;
}

/** Taille maximale d'une trame, en octets (ARCHI standards.taille_max_message_octets). */
export const TAILLE_MAX_TRAME_OCTETS = 4096;

/** Délai maximal d'authentification après ouverture du socket, en millisecondes. */
export const DELAI_MAX_AUTHENTIFICATION_MS = 5000;

/** Limitation de débit (ARCHI standards.limitation_debit.commandes_temps_reel). */
export const DEBIT_MAX_COMMANDES = 20;
export const DEBIT_FENETRE_MS = 10_000;
export const DEBIT_DEPASSEMENTS_AVANT_FERMETURE = 3;

/** Période du battement de cœur et nombre de pongs manqués tolérés. */
export const BATTEMENT_PERIODE_MS = 15_000;
export const BATTEMENT_PONGS_MANQUES_MAX = 2;

/** Codes de fermeture du canal (API-GDV-001 / x-temps-reel). */
export const FERMETURE = {
  jetonInvalide: 4401,
  delaiAuthentification: 4408,
  connexionRemplacee: 4409,
  tropDeRequetes: 4429,
} as const;

/** Nombre d'accusés mémorisés par joueur pour l'idempotence de corrélation. */
export const MEMOIRE_CORRELATION = 32;

/**
 * Champs par lesquels une charge pourrait prétendre désigner son AUTEUR
 * (CA-44, x-temps-reel.authentification.identite_de_l_emetteur).
 *
 * « Aucune commande ne porte l'identifiant de son auteur : il est DÉDUIT de la
 *   connexion authentifiée. Si une charge contient malgré tout un champ qui
 *   prétend désigner un autre joueur comme auteur, la commande est rejetée avec
 *   USURPATION_IDENTITE. »
 *
 * Le contrôle est fait AVANT la validation stricte, sinon la trame sortirait
 * avec MESSAGE_MALFORME et l'incident de sécurité ne serait pas journalisé pour
 * ce qu'il est. Les champs de CIBLE (cible_joueur_id, accuse_joueur_id,
 * emprunteur_joueur_id) ne figurent évidemment pas ici : désigner sa cible est
 * l'objet même de ces commandes.
 */
export const CHAMPS_DESIGNANT_UN_AUTEUR: readonly string[] = Object.freeze([
  'joueur_id',
  'auteur_joueur_id',
  'emetteur_joueur_id',
  'accusateur_joueur_id',
  'enqueteur_joueur_id',
  'preteur_joueur_id',
  'signataire_joueur_id',
  'de_joueur_id',
  'au_nom_de',
]);

/** Vrai si la charge prétend agir au nom d'un joueur autre que le porteur du jeton. */
export function pretendDesignerUnAuteur(
  charge: Readonly<Record<string, unknown>>,
  auteurJoueurId: string,
): boolean {
  return CHAMPS_DESIGNANT_UN_AUTEUR.some((champ) => {
    const valeur = charge[champ];
    return valeur !== undefined && valeur !== auteurJoueurId;
  });
}

/**
 * Enveloppe entrante, STRICTE. `charge` est validée dans un second temps contre
 * le schéma CmdXxx correspondant au type : deux étapes, deux refus distincts
 * (COMMANDE_INCONNUE puis MESSAGE_MALFORME).
 */
export const SchemaEnveloppeCommande = z.strictObject({
  id_correlation: z.uuid(),
  type: z.enum(TYPES_COMMANDE),
  charge: z.record(z.string(), z.unknown()),
});
