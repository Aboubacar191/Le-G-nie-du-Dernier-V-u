// PREUVE — RG-78 : aucune saisie de montant ne passe par un clavier numérique.
//
// « input[type=number], input[type=text] et tout clavier logiciel sont interdits
//   pour tout montant. » La raison n'est pas ergonomique mais double, et les
//   deux moitiés comptent : un clavier logiciel consomme la moitié d'une
//   fenêtre de 30 s pour deux actes simultanés sur toute la table, ET il
//   affiche la valeur en grand au centre de l'écran, donc au voisin assis.
//
// Le test porte sur TOUT le code source, pas seulement sur l'incrémenteur : une
// interdiction qui ne vaudrait que pour un fichier serait contournée au premier
// écran pressé.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { bornes, borner, decrementer, incrementer, PAS_RAPIDE } from '../src/logique/montant.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');

function fichiers(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiers(chemin));
    else if (entree.name.endsWith('.vue') || entree.name.endsWith('.ts')) trouves.push(chemin);
  }
  return trouves;
}

const SOURCES = fichiers(SOURCE);
const chemin = (absolu: string): string => relative(SOURCE, absolu).split('\\').join('/');

/** Le seul champ texte admis : pseudo et code d'adhésion, hors phase minutée. */
const CHAMP_ADMIS = 'composants/ChampTexteCourt.vue';

test('aucun input[type=number] n’existe dans le code source', () => {
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    const contenu = readFileSync(absolu, 'utf8');
    if (/type\s*=\s*["']number["']/u.test(contenu)) fautifs.push(chemin(absolu));
    if (/type\s*=\s*["']range["']/u.test(contenu)) fautifs.push(`${chemin(absolu)} (range)`);
  }
  assert.deepEqual(fautifs, [], `clavier numérique : ${fautifs.join(', ')}`);
});

test('aucun inputmode numérique, décimal ou téléphonique n’est déclaré', () => {
  const interdits = /inputmode\s*=\s*["'](numeric|decimal|tel)["']/u;
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    if (interdits.test(readFileSync(absolu, 'utf8'))) fautifs.push(chemin(absolu));
  }
  assert.deepEqual(fautifs, [], `inputmode numérique : ${fautifs.join(', ')}`);
});

test('le seul élément de saisie de l’application est ChampTexteCourt', () => {
  const fautifs: string[] = [];
  for (const absolu of SOURCES) {
    if (chemin(absolu) === CHAMP_ADMIS) continue;
    const contenu = readFileSync(absolu, 'utf8');
    // On cherche la BALISE, pas le mot : « input » apparaît dans @input et dans
    // les commentaires sans qu'aucun champ ne soit rendu.
    if (/<input\b/u.test(contenu) || /<textarea\b/u.test(contenu)) fautifs.push(chemin(absolu));
  }
  assert.deepEqual(fautifs, [], `élément de saisie hors du champ texte : ${fautifs.join(', ')}`);
});

test('l’incrémenteur ne rend aucun champ et porte la sémantique spinbutton', () => {
  const incrementeur = readFileSync(
    resolve(SOURCE, 'composants', 'IncrementeurMontant.vue'),
    'utf8',
  );
  assert.ok(!/<input\b/u.test(incrementeur), 'l’incrémenteur ne doit rendre aucun champ');
  assert.ok(incrementeur.includes("role=\"spinbutton\""), 'sémantique spinbutton absente');
  assert.ok(incrementeur.includes('aria-valuenow'), 'aria-valuenow absent');
  assert.ok(incrementeur.includes('aria-valuemin'), 'aria-valuemin absent');
  assert.ok(incrementeur.includes('aria-valuemax'), 'aria-valuemax absent');
});

test('les pas de l’incrémenteur sont des cibles de 64 px, par jeton', () => {
  const incrementeur = readFileSync(
    resolve(SOURCE, 'composants', 'IncrementeurMontant.vue'),
    'utf8',
  );
  assert.ok(
    incrementeur.includes('var(--gdv-hauteur-pas-incrementeur)'),
    'la hauteur du pas doit venir du jeton composant.hauteur.pas_incrementeur',
  );
  assert.ok(
    incrementeur.includes('var(--gdv-largeur-pas-incrementeur)'),
    'la largeur du pas doit venir du jeton composant.largeur.pas_incrementeur',
  );
});

test('le parcours clavier couvre les quatre gestes du contrat', () => {
  const incrementeur = readFileSync(
    resolve(SOURCE, 'composants', 'IncrementeurMontant.vue'),
    'utf8',
  );
  for (const touche of ['keydown.up', 'keydown.down', 'keydown.page-up', 'keydown.page-down', 'keydown.home', 'keydown.end']) {
    assert.ok(incrementeur.includes(touche), `raccourci ${touche} absent`);
  }
});

test('la saisie reste dans ses bornes, et en entiers', () => {
  const limites = bornes(0, 7);
  assert.equal(incrementer(7, limites), 7, 'la borne haute ne se dépasse pas');
  assert.equal(decrementer(0, limites), 0, 'la borne basse ne se dépasse pas');
  assert.equal(incrementer(0, limites, PAS_RAPIDE), 5, 'le pas rapide vaut 5');
  assert.equal(borner(3.9, limites), 3, 'aucun flottant ne sort de la saisie');
  assert.equal(borner(Number.NaN, limites), 0, 'une valeur non finie retombe sur la borne basse');
});

test('une borne haute inférieure à la borne basse est ramenée, jamais inversée', () => {
  // Cas réel : le solde tombe à 0 pendant la négociation alors que le minimum
  // d'un prêt est 1. L'incrémenteur doit rester cohérent plutôt que d'offrir
  // un intervalle vide dans lequel aucune valeur n'est saisissable.
  const limites = bornes(1, 0);
  assert.equal(limites.min, 1);
  assert.equal(limites.max, 1);
  assert.equal(borner(5, limites), 1);
});
