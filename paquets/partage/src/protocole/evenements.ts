// Événements serveur → client (EvtXxx dans API-GDV-001.json).
//
// AMORCE — nœud S4 (dev-backend) : un type par événement sortant, dérivé de
// API-GDV-001.json. Aucun type d'événement n'est écrit à la main sans schéma
// correspondant dans le contrat : outils/verifier-visibilite.mjs (porte P8)
// échoue si l'énumération et les schémas divergent.
//
// Seule la liste normative des types est transcrite ici
// (EnveloppeEvenement.properties.type.enum).

export const TYPES_EVENEMENT = [
  'accuse_reception',
  'erreur',
  'etat_complet_prive',
  'etat_partie_change',
  'joueur_rejoint',
  'joueur_quitte',
  'joueur_reconnecte',
  'partie_demarree',
  'attribution_privee',
  'voeu_annonce',
  'clause_recue',
  'phase_changee',
  'declaration_publiee',
  'paiement_enregistre',
  'transfert_enregistre',
  'pret_propose',
  'pret_resolu',
  'pret_preleve',
  'revelation_ecart_total',
  'revelation',
  'resultat_enquete',
  'accusation_declaree',
  'accusation_resolue',
  'execution_resultat',
  'solde_mis_a_jour',
  'dernier_voeu_propose',
  'dernier_voeu_resolu',
  'scores_finaux',
  'partie_abandonnee',
  'groupe_mis_a_jour',
] as const;

export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];
