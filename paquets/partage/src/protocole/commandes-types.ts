// Énumération NORMATIVE des types de commande
// (API-GDV-001.json / EnveloppeCommande.properties.type.enum).
//
// Isolée des schémas Zod pour que le lecteur du contrat
// (src/contrat/lecture.ts) puisse la consommer sans dépendre de zod : une
// dépendance circulaire rendrait l'ordre d'initialisation implicite.

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
 * Produites exclusivement par le moteur, sur expiration de minuteur ou sur
 * transition. Conservée ici pour que toute tentative d'ajout se heurte d'abord
 * à une interdiction écrite — et à un test (CA-50).
 */
export const OPERATIONS_SANS_COMMANDE = [
  'execution du pipeline de manche',
  'selection ou emission d une revelation',
  'distribution des roles, missions, clauses ou porteur',
  'tirage du MARCHAND_DEJA_LIE et du GARDIEN_DE_LA_LAMPE',
  'calcul ou publication des scores finaux',
  'attribution ou modification d un solde',
  'modification de la configuration apres la creation',
  'lecture de l etat d un autre joueur',
] as const;
