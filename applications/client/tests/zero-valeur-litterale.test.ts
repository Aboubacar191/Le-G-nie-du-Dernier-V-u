// PREUVE — aucune valeur littérale de couleur, de dimension ou d'espacement
// dans les composants et les écrans.
//
// Le contrat de conception est explicite : « Dans composants et ecrans, toute
// valeur de style est un chemin de token. Aucune valeur litterale n'y figure. »
// Ce test transforme cette phrase en porte.
//
// Trois exceptions, et trois seulement, toutes motivées :
//  1. le ZÉRO sans unité et les pourcentages, qui ne sont pas des dimensions ;
//  2. les mots-clés de disposition (auto, 100%, 100vh, 1fr, fit-content) ;
//  3. les points de rupture dans une règle @media — contrainte TECHNIQUE et non
//     préférence : une variable CSS ne fonctionne pas dans une @media selon la
//     spécification. Le test vérifie en plus que la valeur employée DÉRIVE d'un
//     point de rupture du contrat, à un pixel près (rupture moins 1 pour une
//     borne max-width).
//
// Les fichiers GÉNÉRÉS (styles/jetons.css, styles/jetons.ts) sont hors
// périmètre : ils SONT les valeurs, compilées depuis DESIGN-GDV-001.json.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { RUPTURES } from '../src/styles/jetons.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');

/** Fichiers générés : ils portent les valeurs, c'est leur rôle. */
const GENERES = ['styles/jetons.css', 'styles/jetons.ts'];

function fichiers(racine: string, extensions: readonly string[]): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiers(chemin, extensions));
    else if (extensions.some((extension) => entree.name.endsWith(extension))) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

const chemin = (absolu: string): string => relative(SOURCE, absolu).split('\\').join('/');

// Les FEUILLES DE STYLE autonomes sont analysées elles aussi, et c'est une
// correction : jusqu'ici le périmètre se limitait à .vue et .ts, si bien qu'un
// styles/theme-prototype.css de 50 lignes contenant 30 couleurs hexadécimales
// en dur — et importé par main.ts, donc SURCHARGEANT les jetons compilés — a
// traversé la porte sans l'émouvoir. Le trou était dans la mesure, pas dans la
// règle. Toute feuille de style du client est désormais dedans.
const SOURCES = fichiers(SOURCE, ['.vue', '.ts', '.css']).filter(
  (absolu) => !GENERES.includes(chemin(absolu)),
);

test('le périmètre analysé n’est pas vide', () => {
  assert.ok(SOURCES.length >= 50, `seulement ${SOURCES.length} fichiers analysés`);
});

test('aucune couleur hexadécimale dans un composant ou un écran', () => {
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    const contenu = readFileSync(absolu, 'utf8');
    for (const [index, ligne] of contenu.split('\n').entries()) {
      if (/#[0-9a-fA-F]{3,8}\b/u.test(ligne)) fautifs.push(`${chemin(absolu)}:${index + 1}`);
    }
  }
  assert.deepEqual(fautifs, [], `couleurs hexadécimales : ${fautifs.join(', ')}`);
});

test('aucune couleur fonctionnelle ni nommée dans un composant ou un écran', () => {
  // currentcolor et transparent sont des mots-clés relatifs, pas des couleurs
  // choisies : ils héritent d'un jeton posé plus haut.
  const interdits = /\b(rgba?|hsla?|color\(|lab\(|oklch\()\s*\(|:\s*(red|blue|green|black|white|grey|gray|orange|yellow|purple)\b/u;
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    const contenu = readFileSync(absolu, 'utf8');
    for (const [index, ligne] of contenu.split('\n').entries()) {
      if (interdits.test(ligne)) fautifs.push(`${chemin(absolu)}:${index + 1} ${ligne.trim()}`);
    }
  }
  assert.deepEqual(fautifs, [], `couleurs littérales : ${fautifs.join(' | ')}`);
});

/** Valeurs de longueur admises hors jeton : mots-clés de disposition. */
const DISPOSITION = /^(100vh|100vw|100%)$/u;

const MOTIF_LONGUEUR = /\b\d+(?:\.\d+)?(?:px|rem|em|pt|vw|vh|ch)\b/gu;

/** Longueurs littérales d'une ligne, exceptions du contrat déjà écartées. */
function longueursFautives(ligne: string): readonly string[] {
  // Les points de rupture en @media sont la seule exception technique : une
  // variable CSS ne fonctionne pas dans une règle @media (spécification CSS).
  if (ligne.includes('@media')) return [];
  return (ligne.match(MOTIF_LONGUEUR) ?? []).filter((trouve) => !DISPOSITION.test(trouve));
}

test('aucune dimension littérale hors point de rupture et mot-clé de disposition', () => {
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    for (const [index, ligne] of readFileSync(absolu, 'utf8').split('\n').entries()) {
      for (const trouve of longueursFautives(ligne)) {
        fautifs.push(`${chemin(absolu)}:${index + 1} → ${trouve}`);
      }
    }
  }
  assert.deepEqual(fautifs, [], `dimensions littérales : ${fautifs.join(' | ')}`);
});

test('tout point de rupture employé en @media dérive d’un jeton de rupture', () => {
  const valeursJeton = Object.values(RUPTURES).map((valeur) =>
    Number.parseInt(valeur.replace('px', ''), 10),
  );
  const motifMedia = /@media[^{]*?(\d+)px/gu;
  const fautifs: string[] = [];

  for (const absolu of SOURCES) {
    const contenu = readFileSync(absolu, 'utf8');
    for (const correspondance of contenu.matchAll(motifMedia)) {
      const valeur = Number.parseInt(correspondance[1] ?? '', 10);
      // Une borne max-width vaut la rupture MOINS un pixel : 359 pour 360.
      const derive = valeursJeton.some((jeton) => jeton === valeur || jeton - 1 === valeur);
      if (!derive) fautifs.push(`${chemin(absolu)} → ${valeur}px`);
    }
  }
  assert.deepEqual(fautifs, [], `ruptures hors contrat : ${fautifs.join(' | ')}`);
});

test('toute variable CSS employée est préfixée gdv et définie par le compilateur', () => {
  const jetons = readFileSync(resolve(SOURCE, 'styles', 'jetons.css'), 'utf8');
  const definies = new Set(
    [...jetons.matchAll(/(--gdv-[a-z0-9-]+)\s*:/gu)].map((trouve) => trouve[1] as string),
  );
  const inconnues = new Set<string>();

  for (const absolu of SOURCES) {
    const contenu = readFileSync(absolu, 'utf8');
    for (const trouve of contenu.matchAll(/var\(\s*(--[a-z0-9-]+)/gu)) {
      const nom = trouve[1] as string;
      if (!definies.has(nom)) inconnues.add(`${chemin(absolu)} → ${nom}`);
    }
  }
  assert.deepEqual([...inconnues], [], `variables non définies : ${[...inconnues].join(' | ')}`);
});

test('les deux thèmes sont livrés, et avec les mêmes 29 noms de jeton', () => {
  const jetons = readFileSync(resolve(SOURCE, 'styles', 'jetons.css'), 'utf8');
  assert.ok(jetons.includes("[data-theme='sombre']"), 'thème sombre absent');
  assert.ok(jetons.includes(':root,'), 'thème clair absent de la racine');
  assert.ok(
    jetons.includes('@media (prefers-color-scheme: dark)'),
    'le thème sombre doit s’appliquer avant le script, sur préférence système',
  );

  const bloc = (entete: string): Set<string> => {
    const debut = jetons.indexOf(entete);
    const fin = jetons.indexOf('}', debut);
    return new Set(
      [...jetons.slice(debut, fin).matchAll(/(--gdv-[a-z0-9-]+)\s*:/gu)].map((t) => t[1] as string),
    );
  };

  const clair = bloc(":root,\n[data-theme='clair'] {");
  const sombre = bloc("[data-theme='sombre'] {");
  assert.equal(sombre.size, 29, `le thème sombre porte ${sombre.size} jetons de couleur`);
  for (const nom of sombre) {
    assert.ok(clair.has(nom), `${nom} manque au thème clair`);
  }
});
