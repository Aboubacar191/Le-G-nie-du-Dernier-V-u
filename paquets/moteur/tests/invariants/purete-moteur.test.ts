// Pureté du moteur, vérifiée depuis l'intérieur du paquet.
//
// Les mêmes interdits sont déjà posés par ESLint (no-restricted-syntax,
// no-restricted-imports) et par dependency-cruiser (règle moteur-couche-pure).
// Ce test les redouble parce qu'une règle de lint se désactive avec un
// commentaire, et qu'un `eslint-disable` sur une ligne qui lit l'horloge dans
// le moteur casse le rejeu de toute partie journalisée. Un test, lui, se lit
// dans un rapport d'échec.
//
// Ce fichier ne teste AUCUNE règle de jeu : il n'y en a pas encore.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAQUET = resolve(ICI, '..', '..');
const SOURCES = join(PAQUET, 'src');

function fichiersTs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersTs(chemin));
    else if (entree.endsWith('.ts')) trouves.push(chemin);
  }
  return trouves;
}

const INTERDITS: readonly [RegExp, string][] = [
  [/\bMath\s*\.\s*random\b/, 'Math.random : l’aléa doit être injecté via Alea (ADR-TL-08)'],
  [/\bDate\s*\.\s*now\b/, 'Date.now : l’horloge doit être injectée via Horloge (RG-72)'],
  [/\bnew\s+Date\b/, 'new Date : l’horloge doit être injectée via Horloge (RG-72)'],
  [/\bcrypto\s*\./, 'crypto : la graine est fournie par la couche transport'],
  [/\bprocess\s*\./, 'process : aucune E/S ni environnement dans la couche pure'],
  [/from\s+['"]node:/, 'import node: : le moteur n’importe que @gdv/partage'],
  [/\brequire\s*\(/, 'require : le moteur est en ESM et n’importe que @gdv/partage'],
];

const AUTORISE_HORS_PARTAGE = /^(\.|@gdv\/partage)/;

test('aucun fichier du moteur ne contient une source d’indéterminisme ou une E/S', () => {
  for (const fichier of fichiersTs(SOURCES)) {
    const contenu = readFileSync(fichier, 'utf8');
    const lignes = contenu.split('\n');
    lignes.forEach((ligne, index) => {
      if (ligne.trimStart().startsWith('//')) return;
      for (const [motif, explication] of INTERDITS) {
        assert.ok(
          !motif.test(ligne),
          `${fichier}:${index + 1} — ${explication}\n  ${ligne.trim()}`,
        );
      }
    });
  }
});

test('le moteur n’importe que @gdv/partage et ses propres modules', () => {
  const motifImport = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  for (const fichier of fichiersTs(SOURCES)) {
    const contenu = readFileSync(fichier, 'utf8');
    for (const correspondance of contenu.matchAll(motifImport)) {
      const specificateur = correspondance[1] ?? '';
      assert.ok(
        AUTORISE_HORS_PARTAGE.test(specificateur),
        `${fichier} importe « ${specificateur} » : le moteur ne peut importer que ` +
          `@gdv/partage ou un module relatif.`,
      );
    }
  }
});

test('le manifeste du moteur ne déclare aucune dépendance hors @gdv/partage', () => {
  const manifeste = JSON.parse(readFileSync(join(PAQUET, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifeste.dependencies ?? {}), ['@gdv/partage']);
});
