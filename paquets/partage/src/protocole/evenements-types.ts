// Énumération NORMATIVE des types d'événement
// (API-GDV-001.json / EnveloppeEvenement.properties.type.enum).
//
// Isolée des types de charge pour que src/contrat/lecture.ts puisse la
// consommer sans cycle.

export const TYPES_EVENEMENT = [
  'accuse_reception',
  'erreur',
  'etat_complet_prive',
  'etat_partie_change',
  'joueur_rejoint',
  'joueur_quitte',
  'joueur_reconnecte',
  'joueur_pret_change',
  'partie_demarree',
  'attribution_privee',
  'voeu_annonce',
  'clause_recue',
  'phase_changee',
  'declaration_publiee',
  'paiement_enregistre',
  'joueur_offrande_scellee',
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
