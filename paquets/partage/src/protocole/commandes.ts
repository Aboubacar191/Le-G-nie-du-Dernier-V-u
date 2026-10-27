// Commandes client → serveur (CmdXxx dans API-GDV-001.json).
//
// AMORCE — nœud S4 (dev-backend) : un schéma Zod STRICT par commande, dérivé de
// API-GDV-001.json (additionalProperties refusées). Le code ne redéfinit aucun
// message : le contrat est la source de vérité, pas l'inverse.
//
// Seule la liste des types est transcrite ici : elle est normative
// (EnveloppeCommande.properties.type.enum) et sert à refuser une trame de type
// inconnu avec COMMANDE_INCONNUE.

export const TYPES_COMMANDE = [
  'authentifier',
  'definir_ordre_places',
  'demarrer_partie',
  'avancer_phase',
  'transferer_pieces',
  'proposer_pret',
  'repondre_pret',
  'declarer_contribution',
  'payer_secret',
  'lancer_enquete',
  'accuser',
  'signer_dernier_voeu',
  'abandonner_partie',
] as const;

export type TypeCommande = (typeof TYPES_COMMANDE)[number];

/**
 * Opérations qui n'existent sous AUCUNE forme de commande client (CA-50).
 * Elles sont produites exclusivement par le moteur, sur expiration de minuteur
 * ou sur transition. Liste conservée ici pour que toute tentative d'ajout de
 * commande se heurte d'abord à une interdiction écrite.
 */
export const OPERATIONS_SANS_COMMANDE = [
  'execution du pipeline de manche',
  'selection ou emission d une revelation',
  'distribution des roles, missions, clauses ou porteur',
  'tirage du MARCHAND_DEJA_LIE et du GARDIEN_DE_LA_LAMPE',
  'calcul ou publication des scores finaux',
  'attribution ou modification d un solde',
  'modification de la configuration apres la creation',
] as const;
