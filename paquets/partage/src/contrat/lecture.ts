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
}

interface ContratApi {
  readonly info: { readonly version: string };
  readonly components: { readonly schemas: Readonly<Record<string, SchemaContrat>> };
}

export const CONTRAT_API = contratBrut as unknown as ContratApi;

/** info.version fait foi (ARCHI standards.versionnement_protocole). */
export const VERSION_PROTOCOLE: string = CONTRAT_API.info.version;

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
  const minimum = schemaContrat('EvtRevelation').properties?.suspects_restants?.minimum;
  if (typeof minimum !== 'number') {
    throw new Error(
      'API-GDV-001.json : EvtRevelation.suspects_restants.minimum absent. ' +
        'RG-21 ne serait plus gravé dans le schéma.',
    );
  }
  return minimum;
})();
