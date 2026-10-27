#!/usr/bin/env node
// =============================================================================
// PORTE DE QUALITÉ — règles de couches (ARCHI conventions.regles_de_couches)
// =============================================================================
// Enveloppe de dependency-cruiser, exigée nommément par l'ARCHI
// (conventions.arborescence_depot.outils). Son rôle : rendre le message
// d'échec explicite et garantir que la porte se FERME.
//
// Le moteur ne doit importer ni le serveur, ni le client, ni aucune
// bibliothèque d'entrées/sorties ; le transport ne doit pas court-circuiter
// le module de projection.
//
// Usage  : node outils/verifier-couches.mjs [chemins...]
// Sortie : 0 = couches respectées, 1 = violation (porte fermée)
// =============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(RACINE, '.dependency-cruiser.cjs');

const cibles = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const perimetre = cibles.length > 0 ? cibles : ['paquets', 'applications'];

if (!existsSync(CONFIG)) {
  console.error(`ÉCHEC — configuration de couches absente : ${CONFIG}`);
  process.exit(1);
}

// Le point d'entrée JS est appelé directement, sans passer par le script .cmd de
// node_modules/.bin : sous Windows, spawn d'un .cmd exige un shell, et lancer un
// shell pour une porte de qualité ajoute une couche d'interprétation inutile.
const binaire = join(RACINE, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruiser.mjs');
if (!existsSync(binaire)) {
  console.error(
    'ÉCHEC — dependency-cruiser introuvable : ' +
      `${binaire}\n` +
      '        Lancer `npm install` ; la porte reste fermée tant que l’outil manque ' +
      '(une porte qu’on ne peut pas exécuter ne protège rien).',
  );
  process.exit(1);
}

console.log(`PORTE — couches : dependency-cruiser sur ${perimetre.join(', ')}`);
console.log('-'.repeat(78));

const execution = spawnSync(
  process.execPath,
  [binaire, '--config', CONFIG, '--output-type', 'err', '--no-progress', ...perimetre],
  { cwd: RACINE, stdio: 'inherit', shell: false },
);

if (execution.error) {
  console.error(`ÉCHEC — dependency-cruiser n’a pas pu être lancé : ${execution.error.message}`);
  process.exit(1);
}

const code = execution.status ?? 1;
console.log('-'.repeat(78));
if (code === 0) {
  console.log('VERDICT COUCHES RESPECTÉES');
  process.exit(0);
}

console.error(
  'VERDICT VIOLATION DE COUCHE — porte fermée.\n' +
    '  Rappel (ARCHI conventions.regles_de_couches) :\n' +
    '   · partage ne dépend que de zod ;\n' +
    '   · moteur n’importe que @gdv/partage — aucun node:, aucune dépendance externe ;\n' +
    '   · serveur importe partage et moteur, jamais l’inverse ;\n' +
    '   · client n’importe ni moteur ni serveur ;\n' +
    '   · la couche temps réel ne touche le moteur que par src/projection.\n' +
    `  Code de sortie de dependency-cruiser : ${code}`,
);
process.exit(1);
