// =============================================================================
// LECTURE DU CONTRAT DE PROTOCOLE — API-GDV-001.json est la source de vérité
// =============================================================================
// « Le code n'est jamais la source de vérité ; ce fichier l'est » (API, info).
//
// Tout ce qui pourrait être recopié à la main depuis le contrat est DÉRIVÉ ici :
// la classe de visibilité de chaque événement, la liste des champs déclarés par
// chaque schéma, le minimum de suspects publics, la version du protocole. Une
// recopie dérive ; une dérivation ne peut pas.
//
// Aucune logique de jeu. Aucune E/S : le contrat est importé comme module JSON.

import contratBrut from './api.json' with { type: 'json' };

import { TYPES_COMMANDE, type TypeCommande } from '../protocole/commandes-types.ts';
import { TYPES_EVENEMENT, type TypeEvenement } from '../protocole/evenements-types.ts';

/** Forme minimale exploitée du contrat. Le reste du document n'est pas typé ici. */
export interface SchemaContrat {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, SchemaContrat>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | SchemaContrat;
  readonly items?: SchemaContrat;
  readonly anyOf?: readonly SchemaContrat[];
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly $ref?: string;
  readonly 'x-visibilite'?: string;
  readonly 'x-emission'?: string;
  readonly 'x-charge-neutre'?: readonly string[];
  readonly 'x-charge-par-destinataire'?: Readonly<Record<string, readonly string[]>>;
}

interface ContratApi {
  readonly info: { readonly version: string };
  readonly servers?: readonly { readonly url?: string }[];
  readonly components: { readonly schemas: Readonly<Record<string, SchemaContrat>> };
  readonly 'x-temps-reel'?: {
    readonly canal?: Readonly<Record<string, unknown>>;
  };
}

export const CONTRAT_API = contratBrut as unknown as ContratApi;

/** info.version fait foi (ARCHI standards.versionnement_protocole). */
export const VERSION_PROTOCOLE: string = CONTRAT_API.info.version;

/**
 * Préfixe des routes REST, DÉRIVÉ de servers[0].url (RUP-04, ADR-TL-23).
 *
 * Le préfixe n'est écrit en littéral NI ici NI dans le serveur : un littéral
 * serait la troisième source de vérité que ADR-TL-23 supprime, après le contrat
 * et la réécriture du proxy de développement. ANO-11 a été mesurée à 0 route
 * sur 6 précisément parce que rien ne reliait le serveur à cette valeur.
 *
 * Un contrat sans serveur déclaré ferme la porte au chargement du module : un
 * préfixe vide par défaut remonterait silencieusement les six routes à la
 * racine, c'est-à-dire exactement le défaut à fermer.
 */
export const PREFIXE_REST: string = (() => {
  const url = CONTRAT_API.servers?.[0]?.url;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(
      'API-GDV-001.json : servers[0].url absent. Le préfixe des routes REST est ' +
        'indéterminable, et aucune valeur par défaut n\'est admise — « / » remonterait ' +
        'les six routes à la racine, ce qui est le défaut ANO-11.',
    );
  }
  const chemin = url.replace(/^[a-z]+:\/\/[^/]*/u, '').replace(/\/$/u, '');
  if (!chemin.startsWith('/')) {
    throw new Error(
      `API-GDV-001.json : servers[0].url « ${url} » ne porte aucun chemin de préfixe.`,
    );
  }
  return chemin;
})();

export const SCHEMAS_CONTRAT: Readonly<Record<string, SchemaContrat>> =
  CONTRAT_API.components.schemas;

/** Résout un schéma par son nom, ou échoue : un schéma absent est un défaut de contrat. */
export function schemaContrat(nom: string): SchemaContrat {
  const schema = SCHEMAS_CONTRAT[nom];
  if (schema === undefined) {
    throw new Error(
      `API-GDV-001.json : schéma « ${nom} » absent de components.schemas. ` +
        `Le code ne redéfinit aucun message : c'est le contrat qui doit être corrigé.`,
    );
  }
  return schema;
}

/** Résout un $ref interne (#/components/schemas/Xxx). */
export function resoudreRef(ref: string): SchemaContrat {
  const PREFIXE = '#/components/schemas/';
  if (!ref.startsWith(PREFIXE)) {
    throw new Error(`Référence non interne non supportée : ${ref}`);
  }
  return schemaContrat(ref.slice(PREFIXE.length));
}

// -----------------------------------------------------------------------------
// RUP-03 — paramètres de taille du canal, LUS dans x-temps-reel.canal.
//
// « La TAILLE d'une trame est observable même sous TLS. Une charge vide de 12
//   octets face à une charge pleine de 300 octets laisse fuir exactement le bit
//   que l'émission à tous prétendait masquer. »
//
// Les deux valeurs sont dérivées et non recopiées : un palier codé en dur dans
// le transport et un autre au contrat dériveraient, et la divergence ne se
// verrait sur aucune porte — la taille n'a pas de schéma qui la valide.
// -----------------------------------------------------------------------------

function entierDuCanal(cle: string): number {
  const valeur = CONTRAT_API['x-temps-reel']?.canal?.[cle];
  if (typeof valeur !== 'number' || !Number.isInteger(valeur) || valeur <= 0) {
    throw new Error(
      `API-GDV-001.json : x-temps-reel.canal.${cle} absent ou non entier positif. ` +
        `Aucune valeur de repli n'est admise : un palier par défaut annulerait RUP-03 ` +
        `sans qu'aucune porte ne le voie.`,
    );
  }
  return valeur;
}

/** Palier de remplissage des trames sortantes, en octets (RG-80, RUP-03). */
export const PALIER_TAILLE_OCTETS: number = entierDuCanal('palier_taille_octets');

/** Plafond d'une trame SORTANTE, remplissage compris (RUP-03). */
export const TAILLE_MAX_TRAME_SORTANTE_OCTETS: number = entierDuCanal(
  'taille_max_trame_sortante_octets',
);

/**
 * La compression est INTERDITE, et c'est une exigence de SÉCURITÉ depuis 1.1.0
 * et non plus une absence de gain : appliquée APRÈS remplissage, elle rendrait
 * la taille compressée fonction du CONTENU — une charge neutre faite de 1000
 * octets de remplissage se comprime beaucoup mieux qu'une charge pleine
 * complétée à la même taille, et l'écart de taille sur le fil réapparaîtrait.
 *
 * La valeur est LUE pour que le transport puisse l'opposer à sa propre
 * configuration : une porte qui compare deux littéraux ne prouve rien.
 */
export const COMPRESSION_CANAL: string = (() => {
  const valeur = CONTRAT_API['x-temps-reel']?.canal?.compression;
  if (typeof valeur !== 'string' || valeur.length === 0) {
    throw new Error('API-GDV-001.json : x-temps-reel.canal.compression absent.');
  }
  return valeur;
})();

/** La compression de trame est-elle autorisée par le contrat ? Non, jamais. */
export const COMPRESSION_AUTORISEE: boolean = !COMPRESSION_CANAL.startsWith('aucune');

// -----------------------------------------------------------------------------
// Nommage : type sur le fil (snake_case) → nom de schéma (CmdXxx / EvtXxx).
// « Aucune autre forme n'est admise » (ARCHI standards.nommage_messages) : la
// conversion est donc mécanique, et un schéma manquant ferme la porte.
// -----------------------------------------------------------------------------
export function versPascal(snake: string): string {
  return snake
    .split('_')
    .map((mot) => (mot.length === 0 ? mot : `${mot[0]?.toUpperCase() ?? ''}${mot.slice(1)}`))
    .join('');
}

function table<C extends string>(
  types: readonly C[],
  prefixe: string,
): Readonly<Record<C, string>> {
  const entrees = types.map((type) => {
    const nom = `${prefixe}${versPascal(type)}`;
    schemaContrat(nom);
    return [type, nom] as const;
  });
  return Object.freeze(Object.fromEntries(entrees)) as Readonly<Record<C, string>>;
}

export const NOM_SCHEMA_PAR_COMMANDE: Readonly<Record<TypeCommande, string>> = table(
  TYPES_COMMANDE,
  'Cmd',
);

export const NOM_SCHEMA_PAR_EVENEMENT: Readonly<Record<TypeEvenement, string>> = table(
  TYPES_EVENEMENT,
  'Evt',
);

// -----------------------------------------------------------------------------
// Classe de destinataire de chaque événement, LUE dans l'annotation x-visibilite.
// Un événement sans annotation ferme la porte : une classe par défaut serait une
// divulgation par défaut, exactement l'inverse de la règle de construction par
// ajout (ADR-TL-09).
// -----------------------------------------------------------------------------
function lireVisibilite(type: TypeEvenement): string {
  const nom = NOM_SCHEMA_PAR_EVENEMENT[type];
  const classe = schemaContrat(nom)['x-visibilite'];
  if (typeof classe !== 'string' || classe.length === 0) {
    throw new Error(
      `API-GDV-001.json : ${nom} ne porte pas d'annotation x-visibilite. ` +
        `Aucune classe par défaut n'est admise : ce serait divulguer par défaut.`,
    );
  }
  return classe;
}

export const VISIBILITE_BRUTE_PAR_EVENEMENT: Readonly<Record<TypeEvenement, string>> =
  Object.freeze(
    Object.fromEntries(TYPES_EVENEMENT.map((type) => [type, lireVisibilite(type)])),
  ) as Readonly<Record<TypeEvenement, string>>;

// -----------------------------------------------------------------------------
// RG-80 / RUP-02 — x-emission, x-charge-neutre, x-charge-par-destinataire.
//
// x-visibilite gouverne CE QUE contient une trame ; x-emission gouverne À QUI,
// QUAND et EN QUELLE TAILLE elle part. Les deux sont normatifs. Les six fuites
// de l'audit du nœud S6 ont toutes franchi une porte de visibilité verte :
// aucune ne passait par un champ, toutes passaient par la FORME.
//
// Comme pour x-visibilite, rien n'est recopié : tout est LU. Une annotation
// absente ferme la porte au chargement du module — c'était le défaut réel de
// l'API 1.1.0, neuf schémas sur trente sans x-emission, que personne n'a vu.
// -----------------------------------------------------------------------------

function lireEmission(type: TypeEvenement): string {
  const nom = NOM_SCHEMA_PAR_EVENEMENT[type];
  const emission = schemaContrat(nom)['x-emission'];
  if (typeof emission !== 'string' || emission.length === 0) {
    throw new Error(
      `API-GDV-001.json : ${nom} ne porte pas d'annotation x-emission. ` +
        `Aucun mode par défaut n'est admis : une émission que personne n'a décidée est ` +
        `exactement le défaut que RG-80 ferme.`,
    );
  }
  return emission;
}

export const EMISSION_BRUTE_PAR_EVENEMENT: Readonly<Record<TypeEvenement, string>> = Object.freeze(
  Object.fromEntries(TYPES_EVENEMENT.map((type) => [type, lireEmission(type)])),
) as Readonly<Record<TypeEvenement, string>>;

/**
 * Champs de la charge NEUTRE, celle que reçoit un destinataire hors classe.
 * `null` quand le schéma n'en déclare pas — soit il est exempté, soit sa charge
 * est identique pour tous et il n'existe aucun non-destinataire.
 *
 * Un tableau VIDE et `null` ne sont pas la même chose : `[]` signifie « la
 * charge neutre est l'objet vide », `null` signifie « il n'y a pas de charge
 * neutre ». Confondre les deux ferait émettre {} là où rien ne doit partir.
 */
export const CHARGE_NEUTRE_PAR_EVENEMENT: Readonly<
  Record<TypeEvenement, readonly string[] | null>
> = Object.freeze(
  Object.fromEntries(
    TYPES_EVENEMENT.map((type) => {
      const brut = schemaContrat(NOM_SCHEMA_PAR_EVENEMENT[type])['x-charge-neutre'];
      return [type, brut === undefined ? null : Object.freeze([...brut])];
    }),
  ),
) as Readonly<Record<TypeEvenement, readonly string[] | null>>;

/**
 * Variantes de charge nommées (x-charge-par-destinataire). Un seul schéma en
 * porte aujourd'hui, EvtPretPreleve, et c'est ADR-TL-22 / ANO-07 : le prêteur
 * reçoit une charge RÉDUITE, parce que la conjonction montant_preleve et
 * reliquat_du livre le solde EXACT de l'emprunteur.
 */
export const VARIANTES_CHARGE_PAR_EVENEMENT: Readonly<
  Record<TypeEvenement, Readonly<Record<string, readonly string[]>> | null>
> = Object.freeze(
  Object.fromEntries(
    TYPES_EVENEMENT.map((type) => {
      const brut = schemaContrat(NOM_SCHEMA_PAR_EVENEMENT[type])['x-charge-par-destinataire'];
      return [type, brut === undefined ? null : Object.freeze({ ...brut })];
    }),
  ),
) as Readonly<Record<TypeEvenement, Readonly<Record<string, readonly string[]>> | null>>;

/** Champs DÉCLARÉS au contrat pour un événement — base de la propriété (P-a). */
export const CHAMPS_DECLARES_PAR_EVENEMENT: Readonly<Record<TypeEvenement, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      TYPES_EVENEMENT.map((type) => [
        type,
        Object.freeze(Object.keys(schemaContrat(NOM_SCHEMA_PAR_EVENEMENT[type]).properties ?? {})),
      ]),
    ),
  ) as Readonly<Record<TypeEvenement, readonly string[]>>;

/**
 * RG-21 gravé dans le schéma : EvtRevelation.suspects_restants porte minimum 2.
 * La valeur est LUE, pas réécrite — elle n'est pas un paramètre d'équilibrage et
 * n'a donc pas sa place dans parametres_configuration, mais elle n'a pas non plus
 * sa place en littéral dans le moteur.
 */
export const MINIMUM_SUSPECTS_PUBLICS: number = (() => {
  const schema = schemaContrat('EvtRevelation').properties?.suspects_restants;
  const minimumDirect = schema?.minimum;
  const minimumOptionnel = schema?.anyOf?.find(
    (variante) => typeof variante.minimum === 'number',
  )?.minimum;
  const minimum = minimumDirect ?? minimumOptionnel;
  if (typeof minimum !== 'number') {
    throw new Error(
      'API-GDV-001.json : EvtRevelation.suspects_restants.minimum absent. ' +
        'RG-21 ne serait plus gravé dans le schéma.',
    );
  }
  return minimum;
})();
