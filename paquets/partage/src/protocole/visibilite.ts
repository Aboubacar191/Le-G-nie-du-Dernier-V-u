// =============================================================================
// REGISTRE DE VISIBILITÉ — frontière de sécurité déclarée (RG-01, priorité 1)
// =============================================================================
// « Il n'existe AUCUN message d'état global diffusé à tous. Chaque message
//   sortant est une projection calculée pour un destinataire unique. »
//
// Ce fichier ne CALCULE rien : le calcul vit dans paquets/moteur/src/projection
// (ADR-TL-09), jamais dans le transport. Ici : des valeurs et des types.

import {
  EMISSION_BRUTE_PAR_EVENEMENT,
  MINIMUM_SUSPECTS_PUBLICS,
  VISIBILITE_BRUTE_PAR_EVENEMENT,
  NOM_SCHEMA_PAR_EVENEMENT,
} from '../contrat/lecture.ts';
import { CODES_ERREUR, type CodeErreur } from './codes-erreur.ts';
import { TYPES_EVENEMENT, type TypeEvenement } from './evenements-types.ts';

export {
  MINIMUM_SUSPECTS_PUBLICS,
  CHAMPS_DECLARES_PAR_EVENEMENT,
  CHARGE_NEUTRE_PAR_EVENEMENT,
  COMPRESSION_AUTORISEE,
  COMPRESSION_CANAL,
  NOM_SCHEMA_PAR_EVENEMENT,
  PALIER_TAILLE_OCTETS,
  PREFIXE_REST,
  TAILLE_MAX_TRAME_SORTANTE_OCTETS,
  VARIANTES_CHARGE_PAR_EVENEMENT,
  VERSION_PROTOCOLE,
} from '../contrat/lecture.ts';

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
  // montant_amende_liquide est AJOUTÉ par ARCHI v1.1.0 (_correction_v1_1_0 de
  // l'entité accusations) : il était absent du registre en v1.0.0 alors que le
  // contrat le déclarait secret jusqu'à l'étape 16. Sa libération est portée
  // par la classe x-visibilite de EvtExecutionResultat, et par rien d'autre
  // (registre_champs_secrets.liberation_temporelle).
  accusations: ['ampleur_mensonge', 'montant_amende_du', 'montant_amende_liquide'],
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
 * La table n'est pas recopiée : elle est LUE dans l'annotation x-visibilite de
 * API-GDV-001.json (src/contrat/lecture.ts). Une recopie dérive, une
 * dérivation ne peut pas. Une classe inconnue du protocole ferme la porte au
 * chargement du module plutôt que de valoir « tous » par défaut : divulguer
 * par défaut est exactement ce que la construction par ajout interdit.
 *
 * La cohérence contrat ↔ matrice métier est, elle, vérifiée en porte
 * d'intégration par outils/verifier-visibilite.mjs.
 */
export type VisibiliteParEvenement = Readonly<Record<TypeEvenement, ClasseDestinataire>>;

function exigerClasse(type: TypeEvenement): ClasseDestinataire {
  const brute = VISIBILITE_BRUTE_PAR_EVENEMENT[type];
  const connue = (CLASSES_DESTINATAIRE as readonly string[]).includes(brute);
  if (!connue) {
    throw new Error(
      `API-GDV-001.json : ${NOM_SCHEMA_PAR_EVENEMENT[type]} déclare x-visibilite ` +
        `« ${brute} », qui n'est pas une classe de destinataire admise ` +
        `(${CLASSES_DESTINATAIRE.join(', ')}).`,
    );
  }
  return brute as ClasseDestinataire;
}

export const VISIBILITE_PAR_EVENEMENT: VisibiliteParEvenement = Object.freeze(
  Object.fromEntries(TYPES_EVENEMENT.map((type) => [type, exigerClasse(type)])),
) as VisibiliteParEvenement;

/** Nombre minimal de suspects publics après émission d'une révélation (RG-21). */
export const SUSPECTS_MINIMUM = MINIMUM_SUSPECTS_PUBLICS;

// =============================================================================
// RG-80 / RUP-02 — MODES D'ÉMISSION
// =============================================================================
// « La FORME du trafic est une information au même titre que son contenu. »
//
// x-visibilite dit QUI a le droit de lire le contenu ; x-emission dit À QUI la
// trame part. Les deux ne se confondent plus : toute trame part à TOUS, et le
// non-destinataire reçoit la charge neutre déclarée par le schéma. L'adressage
// sélectif ÉTAIT le canal de fuite ; le contenu sélectif est la règle de
// sécurité. On garde le second, on supprime le premier.

/**
 * Vocabulaire NORMATIF de x-emission
 * (API x-temps-reel.uniformite_de_forme). Une valeur inconnue ferme la porte au
 * chargement du module : un mode inventé serait une exception que personne n'a
 * décidée, et la liste des exceptions est FERMÉE — y ajouter une ligne exige un
 * ADR, pas un ajustement de code.
 */
export const MODES_EMISSION = [
  /** Toute trame part à tous ; le non-destinataire reçoit x-charge-neutre. */
  'uniforme',
  /** Idem, et l'événement est émis à CHAQUE manche, éligible ou non (CA-15). */
  'uniforme_par_manche',
  /** Idem, sauf les cinq codes d'erreur de protocole, seuls exemptés. */
  'uniforme_sauf_erreurs_de_protocole',
  /** La charge se trouve être identique pour tous : aucun non-destinataire. */
  'uniforme_charge_identique',
  /** EXEMPTÉ de l'émission uniforme. Liste fermée : un seul schéma. */
  'exempte',
] as const;

export type ModeEmission = (typeof MODES_EMISSION)[number];

export type EmissionParEvenement = Readonly<Record<TypeEvenement, ModeEmission>>;

function exigerMode(type: TypeEvenement): ModeEmission {
  const brut = EMISSION_BRUTE_PAR_EVENEMENT[type];
  if (!(MODES_EMISSION as readonly string[]).includes(brut)) {
    throw new Error(
      `API-GDV-001.json : ${NOM_SCHEMA_PAR_EVENEMENT[type]} déclare x-emission ` +
        `« ${brut} », qui n'appartient pas au vocabulaire normatif ` +
        `(${MODES_EMISSION.join(', ')}).`,
    );
  }
  return brut as ModeEmission;
}

export const EMISSION_PAR_EVENEMENT: EmissionParEvenement = Object.freeze(
  Object.fromEntries(TYPES_EVENEMENT.map((type) => [type, exigerMode(type)])),
) as EmissionParEvenement;

/**
 * Les CINQ codes d'erreur exemptés de l'émission uniforme, et eux seuls
 * (API x-temps-reel.uniformite_de_forme.exceptions.erreurs_de_protocole).
 *
 * Transcrits et non dérivés : la clause du contrat est de la prose, et extraire
 * une liste fermée de sécurité par expression régulière sur de la prose serait
 * un filet plus fragile que ce qu'il protège. La transcription est confrontée
 * au texte du contrat par un test mécanique
 * (paquets/partage/tests/contrat-api.test.ts) — même dispositif que
 * CHAMPS_SECRETS_PAR_ENTITE, qui est transcrit de l'ARCHI et comparé entité par
 * entité.
 *
 * Les deux motifs du contrat, qui expliquent pourquoi la liste est SI courte :
 * ces cinq refus ne sont atteignables que par un client qui viole le protocole
 * et décrivent la TRAME, non un acte de jeu ; et les deux premiers surviennent
 * sur un socket anonyme qui n'appartient à aucune session, où il n'existe pas
 * de liste de destinataires. Motif secondaire chiffré : TROP_DE_REQUETES est le
 * seul code qu'un client modifié peut déclencher en rafale, et l'émettre à tous
 * transformerait une limitation de débit en amplificateur.
 *
 * TOUS LES AUTRES REFUS y sont SOUMIS, sans exception : chacun peut sanctionner
 * un acte SECRET. SOLDE_INSUFFISANT sur une enquête est l'exemple exact — un
 * refus adressé au seul enquêteur trahit qu'il a tenté d'enquêter.
 */
export const CODES_ERREUR_PROTOCOLE: readonly CodeErreur[] = Object.freeze([
  'JETON_ABSENT',
  'JETON_INVALIDE',
  'MESSAGE_MALFORME',
  'COMMANDE_INCONNUE',
  'TROP_DE_REQUETES',
] as const satisfies readonly CodeErreur[]);

const ENSEMBLE_CODES_PROTOCOLE: ReadonlySet<string> = new Set(CODES_ERREUR_PROTOCOLE);

/**
 * Un refus décrit-il la TRAME (exempté) ou un ACTE DE JEU (émis à tous) ?
 *
 * Un code inconnu est traité comme un refus de JEU, donc émis à tous : le choix
 * par défaut doit être celui qui ne fuite pas. Se tromper dans ce sens coûte
 * des octets ; se tromper dans l'autre rouvre le canal.
 */
export function estCodeErreurDeProtocole(code: string): boolean {
  return ENSEMBLE_CODES_PROTOCOLE.has(code);
}

/** Codes de refus SOUMIS à l'émission uniforme — le complément des cinq. */
export const CODES_ERREUR_DE_JEU: readonly CodeErreur[] = Object.freeze(
  CODES_ERREUR.filter((code) => !estCodeErreurDeProtocole(code)),
);
