// =============================================================================
// REGISTRE DE VISIBILITÉ — frontière de sécurité déclarée (RG-01, priorité 1)
// =============================================================================
// « Il n'existe AUCUN message d'état global diffusé à tous. Chaque message
//   sortant est une projection calculée pour un destinataire unique. »
//
// Ce fichier ne CALCULE rien : le calcul vit dans paquets/moteur/src/projection
// (ADR-TL-09), jamais dans le transport. Ici : des valeurs et des types.

import type { TypeEvenement } from './evenements.ts';

/**
 * Classes de destinataire admises par x-visibilite
 * (API-GDV-001 / x-temps-reel.classes_de_destinataire).
 *
 * « tous » signifie que la projection se trouve être identique pour chacun, PAS
 * qu'un objet global est diffusé : le message est recalculé et envoyé
 * individuellement à chaque joueur.
 */
export const CLASSES_DESTINATAIRE = [
  'tous',
  'proprietaire',
  'enqueteur',
  'porteur_clause_et_faiseur',
  'hote',
] as const;

export type ClasseDestinataire = (typeof CLASSES_DESTINATAIRE)[number];

/**
 * Registre des champs secrets, QUALIFIÉ PAR ENTITÉ.
 * Transcrit de ARCHI-GDV-001.json / modele_donnees[].champs_secrets.
 *
 * La qualification n'est pas un raffinement cosmétique : plusieurs noms de
 * champs sont secrets dans une entité et publics dans une autre
 * (`joueur_id` est secret dans signatures_dernier_voeu et public dans une
 * déclaration ; `motif` est secret dans mouvements_pieces et public dans un
 * abandon de partie ; `sequence` est secret dans le journal de pièces et
 * structurel dans l'enveloppe). Un registre à plat de noms nus produirait soit
 * des faux positifs qui rendraient le test de projection inexploitable, soit
 * l'habitude de le contourner.
 */
export const CHAMPS_SECRETS_PAR_ENTITE = {
  groupes: ['jeton_hote_hache'],
  sessions: ['graine_alea'],
  joueurs: [
    'jeton_session_hache',
    'role_secret',
    'mission_secrete',
    'solde_pieces',
    'score_activite',
  ],
  manches: [
    'clause_cle',
    'porteur_clause_joueur_id',
    'total_paye',
    'multiplicateur_applique',
    'facteur_amende',
  ],
  contributions: ['montant_paye', 'paye_at'],
  clauses: [],
  revelations: [],
  enquetes: [
    'id',
    'manche_id',
    'enqueteur_joueur_id',
    'cible_joueur_id',
    'cout_paye',
    'resultat_montant_paye',
    'cree_at',
  ],
  accusations: ['ampleur_mensonge', 'montant_amende_du'],
  mouvements_pieces: [
    'delta',
    'motif',
    'contrepartie_joueur_id',
    'solde_apres',
    'sequence',
    'manche_numero',
  ],
  prets: ['principal', 'du_total', 'rembourse', 'preteur_joueur_id', 'emprunteur_joueur_id'],
  signatures_dernier_voeu: ['a_signe', 'joueur_id'],
  journal_commandes: ['charge_json', 'joueur_id', 'type_commande'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type EntiteSecrete = keyof typeof CHAMPS_SECRETS_PAR_ENTITE;

/**
 * Union à plat des noms de champs secrets.
 *
 * USAGE UNIQUE : le rédacteur de journaux applicatifs
 * (applications/serveur/src/journalisation/redacteur.ts). Là, la
 * sur-suppression est sans danger — un champ public expurgé d'un log ne coûte
 * rien, un jeton laissé dans un log coûte une partie entière.
 *
 * NE PAS l'utiliser pour décider d'une projection : s'y référer pour
 * construire un message sortant reviendrait à traiter `joueur_id` ou `sequence`
 * comme toujours secrets. La décision de projection se prend sur
 * CHAMPS_SECRETS_PAR_ENTITE et sur la matrice de visibilité.
 */
export const CHAMPS_SECRETS: readonly string[] = Object.freeze([
  ...new Set(Object.values(CHAMPS_SECRETS_PAR_ENTITE).flat()),
]);

/**
 * Classe de destinataire déclarée par chaque événement sortant.
 *
 * AMORCE — nœud S4 : la table est renseignée depuis l'annotation x-visibilite
 * de API-GDV-001.json, et un test échoue si l'une des deux dérive de l'autre.
 * La cohérence contrat ↔ matrice métier est, elle, vérifiée en porte
 * d'intégration par outils/verifier-visibilite.mjs.
 */
export type VisibiliteParEvenement = Readonly<Record<TypeEvenement, ClasseDestinataire>>;
