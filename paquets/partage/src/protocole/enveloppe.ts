// Enveloppes du canal temps réel (API-GDV-001 / x-temps-reel.enveloppe).
// Amorce : types seuls. Les schémas Zod stricts viennent avec le nœud S4.

import type { CorrelationId, HorodatageIso } from '../domaine/identifiants.ts';
import type { TypeCommande } from './commandes.ts';
import type { TypeEvenement } from './evenements.ts';

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
