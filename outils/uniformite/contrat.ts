// =============================================================================
// LECTURE DU CONTRAT pour la porte verifier:uniformite
// =============================================================================
// Ce module ne contient AUCUN contrôle : il lit API-GDV-001.json et en rend une
// vue typée. Les tables de vocabulaire (valeurs admises de x-emission, clés
// admises de la section exceptions) sont NORMATIVES : une valeur inconnue ferme
// la porte au lieu d'être ignorée. C'est ce qui fait de la liste d'exceptions
// une liste FERMÉE — y ajouter une ligne exige un ADR et une mise à jour de ce
// fichier, c'est-à-dire une relecture.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SchemaEvt {
  readonly nom: string;
  readonly type: string;
  readonly visibilite: string;
  readonly emission: string;
  readonly proprietes: readonly string[];
  readonly chargeNeutre: readonly string[] | null;
  readonly variantes: Readonly<Record<string, readonly string[]>> | null;
}

export type Signaler = (controle: string, detail: string) => void;

interface SchemaBrut {
  readonly 'x-visibilite'?: string;
  readonly 'x-emission'?: string;
  readonly 'x-charge-neutre'?: readonly string[];
  readonly 'x-charge-par-destinataire'?: Readonly<Record<string, readonly string[]>>;
  readonly properties?: Readonly<Record<string, unknown>>;
}

interface ApiBrute {
  readonly info?: { readonly version?: string };
  readonly components?: { readonly schemas?: Readonly<Record<string, SchemaBrut>> };
  readonly 'x-temps-reel'?: {
    readonly uniformite_de_forme?: {
      readonly exceptions?: Readonly<Record<string, unknown>>;
      readonly verification?: {
        readonly U2_exceptions_fermees?: Readonly<Record<string, unknown>>;
      };
    };
  };
}

/**
 * Vocabulaire NORMATIF de x-emission. `exigeChargeNeutre` dit si le schéma doit
 * déclarer x-charge-neutre : une charge identique pour les N destinataires n'a
 * pas de variante neutre, puisqu'il n'existe aucun non-destinataire. `uniforme`
 * et ses variantes conditionnelles, elles, en ont forcément une.
 */
export const EMISSIONS_CONNUES: Readonly<
  Record<string, { readonly exigeChargeNeutre: boolean; readonly exempte: boolean }>
> = {
  uniforme: { exigeChargeNeutre: true, exempte: false },
  uniforme_par_manche: { exigeChargeNeutre: true, exempte: false },
  uniforme_sauf_erreurs_de_protocole: { exigeChargeNeutre: true, exempte: false },
  uniforme_charge_identique: { exigeChargeNeutre: false, exempte: false },
  exempte: { exigeChargeNeutre: false, exempte: true },
};

/**
 * Clés admises de x-temps-reel.uniformite_de_forme.exceptions, et le type
 * d'événement que chacune désigne. `exempte: false` est un cas réel et non une
 * redondance : la clé tous_les_autres_refus est écrite DANS la section
 * exceptions alors qu'elle déclare l'inverse — les refus y sont SOUMIS à
 * l'émission uniforme. Lire les clés de la section comme autant d'exemptions
 * serait donc faux, et c'est exactement le genre de lecture rapide qui ouvre
 * une exception que personne n'a décidée.
 */
export const CLES_EXCEPTIONS_CONNUES: Readonly<
  Record<string, { readonly type: string | null; readonly exempte: boolean }>
> = {
  _regle: { type: null, exempte: false },
  EvtEtatCompletPrive: { type: 'etat_complet_prive', exempte: true },
  erreurs_de_protocole: { type: 'erreur', exempte: true },
  tous_les_autres_refus: { type: 'erreur', exempte: false },
};

/** EvtClauseRecue → clause_recue (ARCHI standards.nommage_messages). */
export const typeDepuisSchema = (nom: string): string =>
  nom
    .replace(/^Evt/u, '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/gu, '$1_$2')
    .toLowerCase();

export interface VueContrat {
  readonly version: string;
  readonly schemas: readonly SchemaEvt[];
  readonly parType: ReadonlyMap<string, SchemaEvt>;
  readonly exceptions: ReadonlySet<string>;
  readonly exceptionsU2: ReadonlySet<string>;
}

/**
 * Clés admises de verification.U2_exceptions_fermees : les trois IDENTIFIANTS
 * de paire (pas des types d'événement, pas des clés libres) que U2_regle
 * exempte — voir le contrat pour la justification complète, qui renvoie à
 * ADR-TL-20. `_regle` et `note_sur_les_quatre_autres_scenarios` sont de la
 * prose, pas des exemptions : les lire comme des identifiants ouvrirait une
 * exception que personne n'a décidée.
 */
const CLES_U2_EXCEPTIONS_CONNUES: ReadonlySet<string> = new Set(['U2/2', 'U2/3', 'U2/6']);

function lireSchema(nom: string, brut: SchemaBrut): SchemaEvt {
  return {
    nom,
    type: typeDepuisSchema(nom),
    visibilite: brut['x-visibilite'] ?? '',
    emission: brut['x-emission'] ?? '',
    proprietes: Object.keys(brut.properties ?? {}),
    chargeNeutre: brut['x-charge-neutre'] ?? null,
    variantes: brut['x-charge-par-destinataire'] ?? null,
  };
}

function lireExceptions(api: ApiBrute, signaler: Signaler): ReadonlySet<string> {
  const declarees = api['x-temps-reel']?.uniformite_de_forme?.exceptions;
  const exemptes = new Set<string>();
  if (declarees === undefined) {
    signaler(
      'U4',
      'API x-temps-reel.uniformite_de_forme.exceptions absent : la liste fermée des ' +
        'exceptions n’existe pas, donc rien ne borne ce que le code peut s’autoriser.',
    );
    return exemptes;
  }
  for (const cle of Object.keys(declarees)) {
    const connue = CLES_EXCEPTIONS_CONNUES[cle];
    if (connue === undefined) {
      signaler(
        'U4',
        `exception « ${cle} » déclarée au contrat et inconnue de l’outil. La liste des ` +
          `exceptions est FERMÉE : une ligne de plus est une décision d’architecture, pas un ` +
          `ajustement. La porte se ferme plutôt que de l’accepter sans relecture.`,
      );
      continue;
    }
    if (connue.exempte && connue.type !== null) exemptes.add(connue.type);
  }
  return exemptes;
}

/**
 * Lit verification.U2_exceptions_fermees : une clé qui commence par « U2/ »
 * et n'est pas dans la liste connue ferme la porte, exactement comme pour
 * lireExceptions — une prose (`_regle`, `note_sur_...`) ne commence jamais
 * ainsi et n'est donc jamais confondue avec une exemption.
 */
function lireExceptionsU2(api: ApiBrute, signaler: Signaler): ReadonlySet<string> {
  const declarees = api['x-temps-reel']?.uniformite_de_forme?.verification?.U2_exceptions_fermees;
  const exemptes = new Set<string>();
  if (declarees === undefined) return exemptes;
  for (const cle of Object.keys(declarees)) {
    if (!cle.startsWith('U2/')) continue;
    if (!CLES_U2_EXCEPTIONS_CONNUES.has(cle)) {
      signaler(
        'U2',
        `exception « ${cle} » déclarée au contrat et inconnue de l’outil. La liste des ` +
          `exceptions de U2 est FERMÉE à U2/2, U2/3 et U2/6 : une ligne de plus est une ` +
          `décision d’architecture, pas un ajustement.`,
      );
      continue;
    }
    exemptes.add(cle);
  }
  return exemptes;
}

export function lireContrat(dossier: string, signaler: Signaler): VueContrat {
  const api = JSON.parse(
    readFileSync(join(dossier, 'API-GDV-001.json'), 'utf8'),
  ) as ApiBrute;
  const bruts = api.components?.schemas ?? {};
  const schemas = Object.keys(bruts)
    .filter((nom) => nom.startsWith('Evt'))
    .map((nom) => lireSchema(nom, bruts[nom] as SchemaBrut));
  if (schemas.length === 0) {
    throw new Error('API-GDV-001.json ne déclare aucun schéma EvtXxx : rien à vérifier.');
  }
  return {
    version: api.info?.version ?? '0.0.0',
    schemas,
    parType: new Map(schemas.map((schema) => [schema.type, schema])),
    exceptions: lireExceptions(api, signaler),
    exceptionsU2: lireExceptionsU2(api, signaler),
  };
}
