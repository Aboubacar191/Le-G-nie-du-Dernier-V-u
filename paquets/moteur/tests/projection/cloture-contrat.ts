// Outillage de la propriété (P-a) : CLÔTURE contre le contrat.
//
// « Toute clé présente dans la sortie est déclarée dans le schéma de
//   l'événement ; aucune clé surnuméraire, jamais. »
//   (ARCHI seuils_qualite.interdits_mecaniques, reformulé par ADR-TL-18)
//
// La vérification est RÉCURSIVE et suit les $ref du contrat : une clé
// surnuméraire enfouie dans un objet imbriqué est une fuite exactement comme
// une clé de premier niveau. C'est ce que la formulation précédente de la règle
// ne détectait pas.

import { resoudreRef, schemaContrat, type SchemaContrat } from '@gdv/partage';

export interface EcartCloture {
  readonly chemin: string;
  readonly motif: string;
}

function resoudre(schema: SchemaContrat): SchemaContrat {
  return schema.$ref === undefined ? schema : resoudre(resoudreRef(schema.$ref));
}

/** Variantes d'un anyOf, hors null. */
function variantes(schema: SchemaContrat): readonly SchemaContrat[] {
  const resolu = resoudre(schema);
  if (resolu.anyOf === undefined) return [resolu];
  return resolu.anyOf
    .map(resoudre)
    .filter((variante) => variante.type !== 'null' && variante.enum === undefined);
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

function verifierObjet(
  valeur: Record<string, unknown>,
  schema: SchemaContrat,
  chemin: string,
  ecarts: EcartCloture[],
): void {
  const proprietes = schema.properties;
  if (proprietes === undefined) {
    // Un objet sans properties déclarées est une carte libre
    // (valeurs d'une révélation, détails d'erreur) : le contrat l'autorise.
    if (schema.additionalProperties === false) {
      for (const cle of Object.keys(valeur)) {
        ecarts.push({ chemin: `${chemin}.${cle}`, motif: 'objet fermé sans propriété déclarée' });
      }
    }
    return;
  }
  for (const [cle, sous] of Object.entries(valeur)) {
    const schemaCle = proprietes[cle];
    if (schemaCle === undefined) {
      ecarts.push({ chemin: `${chemin}.${cle}`, motif: 'clé non déclarée au contrat' });
      continue;
    }
    verifier(sous, schemaCle, `${chemin}.${cle}`, ecarts);
  }
}

function verifier(
  valeur: unknown,
  schema: SchemaContrat,
  chemin: string,
  ecarts: EcartCloture[],
): void {
  if (valeur === null || valeur === undefined) return;
  if (Array.isArray(valeur)) {
    const items = resoudre(schema).items;
    if (items === undefined) return;
    valeur.forEach((element, index) => {
      verifier(element, items, `${chemin}[${index}]`, ecarts);
    });
    return;
  }
  if (!estObjet(valeur)) return;

  const candidats = variantes(schema).filter((variante) => variante.properties !== undefined);
  if (candidats.length === 0) {
    verifierObjet(valeur, resoudre(schema), chemin, ecarts);
    return;
  }
  // Un anyOf est satisfait dès qu'UNE variante accepte toutes les clés.
  const parVariante = candidats.map((variante) => {
    const locaux: EcartCloture[] = [];
    verifierObjet(valeur, variante, chemin, locaux);
    return locaux;
  });
  const acceptee = parVariante.find((locaux) => locaux.length === 0);
  if (acceptee !== undefined) return;
  ecarts.push(...(parVariante[0] ?? []));
}

/** Clés requises absentes : une charge incomplète est un défaut de contrat aussi. */
function verifierRequis(
  valeur: Record<string, unknown>,
  schema: SchemaContrat,
  ecarts: EcartCloture[],
): void {
  for (const requis of schema.required ?? []) {
    if (requis in valeur) continue;
    ecarts.push({ chemin: requis, motif: 'clé REQUISE absente de la charge' });
  }
}

/**
 * (P-a) — La charge est-elle CLOSE sur le schéma de l'événement ?
 * Rend la liste des écarts ; vide signifie conforme.
 */
export function ecartsDeCloture(
  nomSchema: string,
  charge: Readonly<Record<string, unknown>>,
): readonly EcartCloture[] {
  const schema = schemaContrat(nomSchema);
  const ecarts: EcartCloture[] = [];
  verifierObjet(charge as Record<string, unknown>, schema, nomSchema, ecarts);
  verifierRequis(charge as Record<string, unknown>, schema, ecarts);
  return ecarts;
}
