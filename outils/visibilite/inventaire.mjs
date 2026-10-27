// =============================================================================
// INVENTAIRE — ce qu'il y a dans le contrat, et ce que la matrice en dit
// =============================================================================
// Deux constructions, aucune décision :
//   · construireEvenements  : pour chaque EvtXxx, sa classe, ses annotations et
//     la liste des couples (schéma porteur, nom de champ) qu'il peut porter ;
//   · construireIndexChamps : pour chaque champ cartographié, les classes de
//     destinataire autorisées par matrice_visibilite et ses événements de
//     publication.
//
// Les couples (porteur, champ) existent parce que deux schémas peuvent employer
// le même nom pour deux données différentes : MouvementPiece.motif est secret,
// EvtPartieAbandonnee.motif est public.

import { JETON_VERS_CLASSES, CARTOGRAPHIE } from './cartographie.mjs';

export const sansAccent = (texte) =>
  String(texte)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const estPublicationPossible = (devientPublic) =>
  typeof devientPublic === 'string' && !sansAccent(devientPublic).startsWith('jamais');

function sousSchemas(schema) {
  const sous = [];
  if (schema.items) sous.push(schema.items);
  for (const mot of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[mot])) sous.push(...schema[mot]);
  }
  return sous;
}

function parcourir(schemas, schema, porteur, visites, accumulateur) {
  if (!schema || typeof schema !== 'object') return accumulateur;
  if (typeof schema.$ref === 'string') {
    const nom = schema.$ref.replace('#/components/schemas/', '');
    if (visites.has(nom)) return accumulateur;
    visites.add(nom);
    return parcourir(schemas, schemas[nom], nom, visites, accumulateur);
  }
  for (const [cle, valeur] of Object.entries(schema.properties ?? {})) {
    accumulateur.set(`${porteur}.${cle}`, { porteur, champ: cle });
    parcourir(schemas, valeur, porteur, visites, accumulateur);
  }
  for (const sous of sousSchemas(schema)) parcourir(schemas, sous, porteur, visites, accumulateur);
  return accumulateur;
}

export function construireEvenements(schemas, nomsEvt) {
  return nomsEvt.map((nom) => ({
    nom,
    classe: schemas[nom]['x-visibilite'],
    destinataires: schemas[nom]['x-destinataires'],
    justification: schemas[nom]['x-justification-visibilite'],
    occurrences: [...parcourir(schemas, schemas[nom], nom, new Set(), new Map()).values()],
  }));
}

/** Clé déclarée pour une occurrence : forme qualifiée d'abord, forme nue ensuite. */
export function cleDeclaree(occurrence, table) {
  const qualifiee = `${occurrence.porteur}.${occurrence.champ}`;
  if (Object.prototype.hasOwnProperty.call(table, qualifiee)) return qualifiee;
  if (Object.prototype.hasOwnProperty.call(table, occurrence.champ)) return occurrence.champ;
  return null;
}

export function regleDeChamp(occurrence, index) {
  return (
    index.get(`${occurrence.porteur}.${occurrence.champ}`) ?? index.get(occurrence.champ) ?? null
  );
}

function classesAutorisees(visiblePar, donnee, signaler) {
  const classes = new Set();
  for (const jeton of visiblePar) {
    const normalise = sansAccent(jeton);
    const regle = JETON_VERS_CLASSES.find(([prefixe]) => normalise.startsWith(prefixe));
    if (!regle) {
      signaler(
        'P3',
        `matrice_visibilite / « ${donnee} » : jeton visible_par « ${jeton} » inconnu de la ` +
          `table de traduction. Rien n’est vérifié pour cette donnée tant qu’il n’est pas traduit.`,
      );
      continue;
    }
    for (const classe of regle[1]) classes.add(classe);
  }
  return classes;
}

function controlerPublication(donnee, carte, devientPublic, nomsEvt, signaler) {
  const possible = estPublicationPossible(devientPublic);
  if (!possible && carte.publication.length > 0) {
    signaler(
      'P3',
      `matrice_visibilite / « ${donnee} » : la cartographie déclare des événements de ` +
        `publication (${carte.publication.join(', ')}) alors que devient_public vaut ` +
        `« ${devientPublic ?? 'absent'} ». Contradiction entre l’outil et la SPEC.`,
    );
  }
  if (possible && carte.publication.length === 0 && carte.champs.length > 0) {
    signaler(
      'P3',
      `matrice_visibilite / « ${donnee} » : devient_public = « ${devientPublic} » mais aucun ` +
        `événement de publication n’est déclaré dans la cartographie.`,
    );
  }
  for (const nomEvt of carte.publication) {
    if (!nomsEvt.includes(nomEvt)) {
      signaler(
        'P3',
        `matrice_visibilite / « ${donnee} » : l’événement de publication ${nomEvt} n’existe ` +
          `pas dans le contrat.`,
      );
    }
  }
  return possible;
}

/**
 * P3 — chaque entrée de matrice_visibilite doit être cartographiée, et toute
 * cartographie doit correspondre à une entrée existante. Les deux sens sont
 * vérifiés : une entrée ajoutée à la SPEC ferme la porte, un libellé modifié
 * dans la SPEC ferme la porte aussi.
 */
function indexerEntree(entree, carte, nomsEvt, index, signaler) {
  const donnee = entree.donnee;
  const classes = classesAutorisees(entree.visible_par ?? [], donnee, signaler);
  const devientPublic = entree.devient_public ?? null;
  const publicationPossible = controlerPublication(donnee, carte, devientPublic, nomsEvt, signaler);

  for (const champ of carte.champs) {
    if (index.has(champ)) {
      signaler(
        'P3',
        `champ « ${champ} » cartographié deux fois (« ${index.get(champ).donnee} » et ` +
          `« ${donnee} ») : la règle appliquée serait ambiguë.`,
      );
      continue;
    }
    index.set(champ, {
      donnee,
      classes,
      publication: carte.publication,
      devientPublic,
      publicationPossible,
    });
  }
  return { donnee, classes: [...classes], publication: carte.publication };
}

export function construireIndexChamps(entrees, nomsEvt, signaler) {
  const index = new Map();
  const donnees = [];

  for (const entree of entrees) {
    const carte = CARTOGRAPHIE[entree.donnee];
    if (!carte) {
      signaler(
        'P3',
        `matrice_visibilite / « ${entree.donnee} » : aucune cartographie vers les champs du ` +
          `protocole. Entrée ajoutée à la SPEC sans être câblée — la porte se ferme plutôt ` +
          `que de prétendre l’avoir vérifiée.`,
      );
      continue;
    }
    donnees.push(indexerEntree(entree, carte, nomsEvt, index, signaler));
  }

  for (const donnee of Object.keys(CARTOGRAPHIE)) {
    if (!entrees.some((e) => e.donnee === donnee)) {
      signaler(
        'P3',
        `cartographie périmée : « ${donnee} » ne correspond à aucune entrée de ` +
          `matrice_visibilite. Un libellé modifié dans la SPEC rendrait la vérification muette.`,
      );
    }
  }

  return { index, donnees };
}
