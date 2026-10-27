// =============================================================================
// CONTRÔLES P1 à P8 — voir l'en-tête de outils/verifier-visibilite.mjs
// =============================================================================
// Chaque fonction ne fait qu'une chose et signale ses anomalies par `signaler`.
// Aucune ne décide du code de sortie : c'est la porte qui tranche.

import { CHAMPS_NEUTRES } from './cartographie.mjs';
import { cleDeclaree, regleDeChamp } from './inventaire.mjs';

/** Événement exempté de P6 : la re-projection complète privée (RG-73). */
export const EVT_REPROJECTION = 'EvtEtatCompletPrive';

const vide = (valeur) => typeof valeur !== 'string' || valeur.trim() === '';

// --- P1 / P2 ----------------------------------------------------------------
export function controlerAnnotations(evenements, classesDeclarees, signaler) {
  for (const evt of evenements) {
    if (vide(evt.classe)) {
      signaler('P1', `${evt.nom} : annotation x-visibilite absente ou vide.`);
      continue;
    }
    if (!classesDeclarees.includes(evt.classe)) {
      signaler(
        'P2',
        `${evt.nom} : x-visibilite = « ${evt.classe} » n’est pas une classe déclarée ` +
          `(${classesDeclarees.join(', ')}).`,
      );
    }
    if (vide(evt.destinataires)) {
      signaler('P1', `${evt.nom} : annotation x-destinataires absente ou vide.`);
    }
    if (vide(evt.justification)) {
      signaler('P1', `${evt.nom} : annotation x-justification-visibilite absente ou vide.`);
    }
  }
  return `P1/P2 — ${evenements.length} schémas EvtXxx annotés et contrôlés.`;
}

// --- Contrepartie de l'exemption de re-projection ---------------------------
export function controlerExemptionReprojection(evenements, signaler) {
  const reprojection = evenements.find((e) => e.nom === EVT_REPROJECTION);
  if (!reprojection) {
    signaler(
      'P6',
      `${EVT_REPROJECTION} absent du contrat : l’exemption de re-projection complète ` +
        `déclarée par l’outil ne correspond plus à rien.`,
    );
    return;
  }
  if (reprojection.classe !== 'proprietaire') {
    signaler(
      'P6',
      `${EVT_REPROJECTION} a pour classe « ${reprojection.classe} » et non « proprietaire » : ` +
        `l’exemption de re-projection tombe. Un état complet privé diffusé à une autre classe ` +
        `que son propriétaire est une violation directe de RG-01 / RG-73.`,
    );
  }
}

// --- P4 / P5 / P6 -----------------------------------------------------------
const listerClasses = (classes) => [...classes].join(', ') || 'aucune';

function controlerP5(contexte, signaler) {
  const { evt, champ, regle, publiePar, exemptee } = contexte;
  if (regle.classes.size > 0 || publiePar || exemptee) return false;
  const mention = regle.devientPublic ? `, devient_public = « ${regle.devientPublic} »` : '';
  signaler(
    'P5',
    `${evt.nom} [${evt.classe}] porte « ${champ} » (donnée « ${regle.donnee} », ` +
      `visible_par = serveur uniquement${mention}). Aucune classe de destinataire n’est ` +
      `autorisée à la recevoir.`,
  );
  return true;
}

function controlerP4(contexte, signaler) {
  const { evt, champ, regle, publiePar } = contexte;
  if (evt.classe !== 'tous' || regle.classes.has('tous') || publiePar) return false;
  signaler(
    'P4',
    `${evt.nom} est de classe « tous » et porte « ${champ} » (donnée « ${regle.donnee} », ` +
      `visible_par → {${listerClasses(regle.classes)}}). RG-01 : un message de classe tous ` +
      `ne peut contenir que des données visibles de tous, sauf s’il est l’événement de ` +
      `publication déclaré (${regle.publication.join(', ') || 'aucun'}).`,
  );
  return true;
}

function controlerP6(contexte, signaler) {
  const { evt, champ, regle, publiePar, exemptee } = contexte;
  if (exemptee || evt.classe === 'tous' || regle.classes.has(evt.classe) || publiePar) return false;
  signaler(
    'P6',
    `${evt.nom} [${evt.classe}] porte « ${champ} » (donnée « ${regle.donnee} ») dont les ` +
      `classes autorisées sont {${listerClasses(regle.classes)}}.`,
  );
  return true;
}

function controlerOccurrence(evt, occurrence, regle, signaler) {
  // La re-projection complète d'un joueur contient tout ce que CE destinataire a
  // le droit de voir, y compris une donnée devenue publique depuis. Elle
  // n'exempte RIEN de ce qui ne devient jamais public.
  const contexte = {
    evt,
    regle,
    champ: `${occurrence.porteur}.${occurrence.champ}`,
    publiePar: regle.publication.includes(evt.nom),
    exemptee:
      evt.nom === EVT_REPROJECTION && (regle.classes.size > 0 || regle.publicationPossible),
  };
  // Un seul motif est signalé par occurrence : le plus grave d'abord.
  for (const controle of [controlerP5, controlerP4, controlerP6]) {
    if (controle(contexte, signaler)) return;
  }
}

export function controlerChampsParClasse(evenements, index, signaler) {
  let controles = 0;
  for (const evt of evenements) {
    for (const occurrence of evt.occurrences) {
      const regle = regleDeChamp(occurrence, index);
      if (!regle) continue;
      controles += 1;
      controlerOccurrence(evt, occurrence, regle, signaler);
    }
  }
  return `P4/P5/P6 — ${controles} occurrences champ×événement confrontées à la matrice.`;
}

// --- P7 ---------------------------------------------------------------------
export function controlerClassification(evenements, index, signaler) {
  const nonClasses = new Map();
  for (const evt of evenements) {
    for (const occurrence of evt.occurrences) {
      if (regleDeChamp(occurrence, index)) continue;
      if (cleDeclaree(occurrence, CHAMPS_NEUTRES)) continue;
      const cle = `${occurrence.porteur}.${occurrence.champ}`;
      if (!nonClasses.has(cle)) nonClasses.set(cle, []);
      nonClasses.get(cle).push(evt.nom);
    }
  }
  for (const [champ, porteurs] of nonClasses) {
    signaler(
      'P7',
      `champ « ${champ} » (atteint par ${porteurs.join(', ')}) n’est ni rattaché à une entrée ` +
        `de matrice_visibilite ni déclaré neutre avec son motif. Un champ non classé est un ` +
        `champ dont personne n’a vérifié la visibilité.`,
    );
  }

  const occurrences = evenements.flatMap((e) => e.occurrences);
  const presente = (cle) =>
    occurrences.some((o) => o.champ === cle || `${o.porteur}.${o.champ}` === cle);

  for (const champ of Object.keys(CHAMPS_NEUTRES)) {
    if (presente(champ)) continue;
    signaler(
      'P7',
      `champ neutre déclaré « ${champ} » absent de tout EvtXxx : déclaration périmée. Une ` +
        `liste de neutres qui dérive finit par couvrir un champ qui n’existe plus et laisser ` +
        `passer celui qui existe.`,
    );
  }

  const distincts = new Set(occurrences.map((o) => o.champ)).size;
  return (
    `P7 — ${distincts} noms de champs distincts (${occurrences.length} occurrences ` +
    `schéma×champ), tous classés.`
  );
}

// --- P8 ---------------------------------------------------------------------
const kebabDepuisPascal = (nom) =>
  nom
    .replace(/^Evt/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

export function controlerEnumerationTypes(schemas, nomsEvt, signaler) {
  const declares = schemas?.EnveloppeEvenement?.properties?.type?.enum;
  if (!Array.isArray(declares)) {
    signaler('P8', 'EnveloppeEvenement.properties.type.enum absent du contrat.');
    return null;
  }
  const attendus = nomsEvt.map(kebabDepuisPascal);
  for (const attendu of attendus) {
    if (!declares.includes(attendu)) {
      signaler(
        'P8',
        `le type « ${attendu} » (schéma correspondant présent) manque à ` +
          `EnveloppeEvenement.type.enum.`,
      );
    }
  }
  for (const declare of declares) {
    if (!attendus.includes(declare)) {
      signaler(
        'P8',
        `le type « ${declare} » est déclaré dans EnveloppeEvenement.type.enum sans schéma ` +
          `EvtXxx correspondant : un message sans schéma est un message sans visibilité ` +
          `déclarée.`,
      );
    }
  }
  return `P8 — ${declares.length} valeurs de type ↔ ${nomsEvt.length} schémas EvtXxx.`;
}
