#!/usr/bin/env node
// Lance le serveur et le client de développement côte à côte, sans dépendance
// supplémentaire (ARCHI : aucune brique n'entre si aucune exigence ne la porte).
// Arrêt de l'un = arrêt de l'autre, pour ne pas laisser un processus orphelin
// tenir un port sur une machine partagée.
//
// Usage : node outils/dev.mjs

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const enfants = [];
let arretEnCours = false;

function tout_arreter(code) {
  if (arretEnCours) return;
  arretEnCours = true;
  for (const enfant of enfants) {
    if (enfant.exitCode === null) enfant.kill();
  }
  process.exit(code);
}

for (const script of ['dev:serveur', 'dev:client']) {
  const enfant = spawn(npm, ['run', script], { cwd: RACINE, stdio: 'inherit', shell: false });
  enfant.on('exit', (code) => {
    console.log(`\n[dev] ${script} terminé (code ${code ?? 'signal'}) — arrêt de l’ensemble.`);
    tout_arreter(code ?? 1);
  });
  enfant.on('error', (erreur) => {
    console.error(`[dev] ${script} n’a pas pu démarrer : ${erreur.message}`);
    tout_arreter(1);
  });
  enfants.push(enfant);
}

process.on('SIGINT', () => tout_arreter(0));
process.on('SIGTERM', () => tout_arreter(0));
