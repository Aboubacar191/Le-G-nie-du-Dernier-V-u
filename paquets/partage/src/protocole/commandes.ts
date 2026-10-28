// =============================================================================
// SCHÉMAS DE VALIDATION DES COMMANDES ENTRANTES — Zod 4.6.7 (ADR-TL-17)
// =============================================================================
// Les cinq règles opposables de stack._prescription_migration_zod :
//  1. OBJET STRICT obligatoire. Une clé inconnue est un REFUS
//     (MESSAGE_MALFORME), jamais un dépouillement silencieux. En Zod 4,
//     z.object() DÉPOUILLE : mesuré sur 4.6.7, z.object({montant}).parse(
//     {montant:4, injecte:'x'}) rend {montant:4} avec succès. C'est exactement
//     le comportement interdit : il transforme une trame malveillante en trame
//     valide. z.strictObject() rend unrecognized_keys. Un test par commande le
//     vérifie (tests/commandes-strictes.test.ts).
//  2. Toute collection entrante porte une CARDINALITÉ MAXIMALE explicite.
//  3. Toute chaîne entrante porte une longueur maximale explicite.
//  4. Tout entier entrant est borné (minimum ET maximum).
//  5. Les schémas sont dérivés de API-GDV-001.json, qui reste la source de
//     vérité : un schéma qui accepte ce que le contrat refuse est un défaut
//     bloquant. Les bornes ci-dessous sont LUES dans le contrat quand il les
//     porte (tests/commandes-contrat.test.ts le vérifie schéma par schéma).

import { z } from 'zod';

import { schemaContrat, NOM_SCHEMA_PAR_COMMANDE } from '../contrat/lecture.ts';
import { TYPES_COMMANDE, type TypeCommande } from './commandes-types.ts';

export { TYPES_COMMANDE, OPERATIONS_SANS_COMMANDE } from './commandes-types.ts';
export type { TypeCommande } from './commandes-types.ts';

// --- Bornes lues dans le contrat ---------------------------------------------
// Un entier non borné en haut est une surface d'épuisement mémoire ou de
// débordement arithmétique ; le contrat ne borne pas toujours en haut (montant
// minimum 0 sans maximum), car la borne réelle est le solde, vérifié par le
// moteur. Le plafond syntaxique reste nécessaire : il coupe avant tout calcul.
const PLAFOND_MONTANT_SYNTAXIQUE = 1_000_000;
const LONGUEUR_MAX_JETON = 128;
const LONGUEUR_MIN_JETON = 32;
const LONGUEUR_MAX_VERSION = 32;

function minimumContrat(nomSchema: string, champ: string, defaut: number): number {
  const minimum = schemaContrat(nomSchema).properties?.[champ]?.minimum;
  return typeof minimum === 'number' ? minimum : defaut;
}

function maximumContrat(nomSchema: string, champ: string, defaut: number): number {
  const maximum = schemaContrat(nomSchema).properties?.[champ]?.maximum;
  return typeof maximum === 'number' ? maximum : defaut;
}

const CARDINALITE_MAX_ORDRE = (() => {
  const schema = schemaContrat('CmdDefinirOrdrePlaces').properties?.ordre;
  const maximum = (schema as { maxItems?: number } | undefined)?.maxItems;
  if (typeof maximum !== 'number') {
    throw new Error(
      'API-GDV-001.json : CmdDefinirOrdrePlaces.ordre.maxItems absent. ' +
        'Aucun tableau non borné n’est admis sur une frontière de sécurité.',
    );
  }
  return maximum;
})();

const CARDINALITE_MIN_ORDRE = (() => {
  const schema = schemaContrat('CmdDefinirOrdrePlaces').properties?.ordre;
  return (schema as { minItems?: number } | undefined)?.minItems ?? 2;
})();

const identifiant = (): z.ZodType<string> => z.uuid();

const montant = (nomSchema: string): z.ZodType<number> =>
  z
    .number()
    .int()
    .min(minimumContrat(nomSchema, 'montant', 0))
    .max(maximumContrat(nomSchema, 'montant', PLAFOND_MONTANT_SYNTAXIQUE));

// --- Un schéma STRICT par commande -------------------------------------------

export const CmdAuthentifier = z.strictObject({
  jeton_session: z.string().min(LONGUEUR_MIN_JETON).max(LONGUEUR_MAX_JETON),
  version_protocole: z.string().min(1).max(LONGUEUR_MAX_VERSION),
});

export const CmdDefinirOrdrePlaces = z.strictObject({
  ordre: z
    .array(identifiant())
    .min(CARDINALITE_MIN_ORDRE)
    .max(CARDINALITE_MAX_ORDRE)
    .refine((liste) => new Set(liste).size === liste.length, {
      message: 'uniqueItems : l’ordre des places est une permutation, pas une liste à doublons',
    }),
});

export const CmdDemarrerPartie = z.strictObject({});

export const CmdAvancerPhase = z.strictObject({});

export const CmdTransfererPieces = z.strictObject({
  cible_joueur_id: identifiant(),
  montant: montant('CmdTransfererPieces'),
});

export const CmdProposerPret = z.strictObject({
  emprunteur_joueur_id: identifiant(),
  principal: z
    .number()
    .int()
    .min(minimumContrat('CmdProposerPret', 'principal', 1))
    .max(PLAFOND_MONTANT_SYNTAXIQUE),
});

export const CmdRepondrePret = z.strictObject({
  pret_id: identifiant(),
  accepte: z.boolean(),
});

export const CmdDeclarerContribution = z.strictObject({
  montant: montant('CmdDeclarerContribution'),
});

export const CmdPayerSecret = z.strictObject({
  montant: montant('CmdPayerSecret'),
});

export const CmdLancerEnquete = z.strictObject({
  cible_joueur_id: identifiant(),
});

export const CmdAccuser = z.strictObject({
  accuse_joueur_id: identifiant(),
});

export const CmdSignerDernierVoeu = z.strictObject({
  a_signe: z.boolean(),
});

export const CmdAbandonnerPartie = z.strictObject({
  confirmation: z.literal(true),
});

/**
 * Table de validation, une entrée par type de commande du protocole.
 * Un type absent du catalogue est rejeté avec COMMANDE_INCONNUE : le serveur
 * n'ignore jamais silencieusement une trame.
 */
export const SCHEMAS_COMMANDE = {
  authentifier: CmdAuthentifier,
  definir_ordre_places: CmdDefinirOrdrePlaces,
  demarrer_partie: CmdDemarrerPartie,
  avancer_phase: CmdAvancerPhase,
  transferer_pieces: CmdTransfererPieces,
  proposer_pret: CmdProposerPret,
  repondre_pret: CmdRepondrePret,
  declarer_contribution: CmdDeclarerContribution,
  payer_secret: CmdPayerSecret,
  lancer_enquete: CmdLancerEnquete,
  accuser: CmdAccuser,
  signer_dernier_voeu: CmdSignerDernierVoeu,
  abandonner_partie: CmdAbandonnerPartie,
} as const satisfies Readonly<Record<TypeCommande, z.ZodType>>;

/** Nom du schéma OpenAPI correspondant, pour les messages de refus et les tests. */
export const NOM_SCHEMA_COMMANDE = NOM_SCHEMA_PAR_COMMANDE;

export type ChargeAuthentifier = z.infer<typeof CmdAuthentifier>;
export type ChargeDefinirOrdrePlaces = z.infer<typeof CmdDefinirOrdrePlaces>;
export type ChargeTransfererPieces = z.infer<typeof CmdTransfererPieces>;
export type ChargeProposerPret = z.infer<typeof CmdProposerPret>;
export type ChargeRepondrePret = z.infer<typeof CmdRepondrePret>;
export type ChargeMontant = z.infer<typeof CmdDeclarerContribution>;
export type ChargeLancerEnquete = z.infer<typeof CmdLancerEnquete>;
export type ChargeAccuser = z.infer<typeof CmdAccuser>;
export type ChargeSignerDernierVoeu = z.infer<typeof CmdSignerDernierVoeu>;
export type ChargeAbandonnerPartie = z.infer<typeof CmdAbandonnerPartie>;

/** Vrai si le type reçu appartient au catalogue (sinon : COMMANDE_INCONNUE). */
export function estTypeCommande(type: unknown): type is TypeCommande {
  return typeof type === 'string' && (TYPES_COMMANDE as readonly string[]).includes(type);
}
