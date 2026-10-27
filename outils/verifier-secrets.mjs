#!/usr/bin/env node
// =============================================================================
// PORTE DE QUALITÉ — balayage de secrets
// =============================================================================
// Exigée par ARCHI seuils_qualite.commandes_de_verification :
//   « node ~/.claude/equipe/outils/scanner-secrets.mjs . — aucun secret en dur »
//
// Cette enveloppe fait trois choses et les dit :
//  1. elle localise le scanner d'équipe et FERME la porte s'il est introuvable —
//     une porte qu'on ne peut pas exécuter ne protège rien, et l'absence d'outil
//     doit se voir ;
//  2. elle interprète son code de sortie ;
//  3. elle distingue « secret détecté » de « outil en échec », et ferme la porte
//     dans les deux cas.
//
// Niveaux rendus par le scanner :
//   EXPOSITION  suivi par git, donc DÉJÀ dans l'historique → révoquer et purger
//   A_RISQUE    non suivi mais non ignoré → ajouter au .gitignore
//   LOCAL       ignoré par git → informatif
//
// ---------------------------------------------------------------------------
// LIMITE CONNUE DE L'OUTIL D'ÉQUIPE, signalée au chef de projet (2026-10-27)
// ---------------------------------------------------------------------------
// scanner-secrets.mjs classe ses trouvailles en interrogeant
//   git ls-files --others --ignored --exclude-standard
// via execSync, dont le maxBuffer vaut 1 Mo. Sur un dépôt Node après
// `npm install`, cette commande énumère node_modules : ici 20 173 fichiers,
// 1,17 Mo — donc ENOBUFS. L'exception est avalée par un catch qui laisse la
// liste des fichiers ignorés à null tout en ayant déjà rempli celle des fichiers
// suivis, et le classement plante ensuite sur « Cannot read properties of null
// (reading 'has') ». Conséquence : dès qu'il y a UNE trouvaille, le scanner
// s'interrompt avant d'imprimer quoi que ce soit.
//
// Il n'est pas corrigé ici : ce n'est pas l'outil de ce dépôt. La porte, elle,
// reste fiable dans le sens qui compte — elle ferme. Et pour rester EXPLOITABLE,
// cette enveloppe relance le scanner répertoire par répertoire quand la passe
// globale échoue : depuis un sous-répertoire, l'énumération git reste bornée
// (0 octet ici) et le classement fonctionne.
//
// Usage  : node outils/verifier-secrets.mjs [racine]
// Sortie : 0 = aucun secret bloquant, 1 = porte fermée
// =============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cible = resolve(process.argv[2] ?? RACINE);

const SIGNATURE_PANNE_CLASSEMENT = /Cannot read properties of null \(reading 'has'\)|ENOBUFS/;
const IGNORES = new Set(['node_modules', '.git', 'dist', 'coverage', 'rapports', '.idea']);

const candidats = [
  process.env.GDV_SCANNER_SECRETS,
  join(homedir(), '.claude', 'equipe', 'outils', 'scanner-secrets.mjs'),
].filter(Boolean);

const scanner = candidats.find((chemin) => existsSync(chemin));

console.log('PORTE — secrets : aucun secret en dur dans le dépôt ni dans une image');
console.log('-'.repeat(78));

if (!scanner) {
  console.error(
    'ÉCHEC — scanner-secrets.mjs introuvable. Chemins essayés :\n' +
      candidats.map((c) => `        ${c}`).join('\n') +
      '\n        Définir GDV_SCANNER_SECRETS pour imposer un chemin.\n' +
      '        La porte reste FERMÉE : un balayage qui n’a pas eu lieu ne prouve rien.',
  );
  process.exit(1);
}

console.log(`  outil  : ${scanner}`);
console.log(`  racine : ${cible}`);

function balayer(racine) {
  const execution = spawnSync(process.execPath, [scanner, racine], {
    cwd: RACINE,
    encoding: 'utf8',
    shell: false,
  });
  if (execution.error) {
    return { code: 1, sortie: `le scanner n’a pas pu être lancé : ${execution.error.message}` };
  }
  return {
    code: execution.status ?? 1,
    sortie: `${execution.stdout ?? ''}${execution.stderr ?? ''}`.trimEnd(),
  };
}

// --- Passe 1 : détection sur tout le dépôt ----------------------------------
const globale = balayer(cible);
console.log('-'.repeat(78));

if (globale.code === 0) {
  console.log(globale.sortie || 'AUCUN SECRET DETECTE');
  console.log('VERDICT AUCUN SECRET BLOQUANT');
  process.exit(0);
}

// --- Passe 2 : classement répertoire par répertoire --------------------------
const panneClassement = SIGNATURE_PANNE_CLASSEMENT.test(globale.sortie);
if (panneClassement) {
  console.error(
    'AVERTISSEMENT — le scanner d’équipe s’est interrompu pendant le CLASSEMENT ' +
      '(limite connue, voir l’en-tête de ce fichier).\n' +
      '  La détection, elle, a bien trouvé au moins une trouvaille. Relance par ' +
      'répertoire pour obtenir des niveaux exploitables :',
  );
  const sousRacines = readdirSync(cible)
    .filter((entree) => !IGNORES.has(entree))
    .map((entree) => join(cible, entree))
    .filter((chemin) => {
      try {
        return statSync(chemin).isDirectory();
      } catch {
        return false;
      }
    });
  for (const sousRacine of sousRacines) {
    const partielle = balayer(sousRacine);
    if (partielle.code !== 0 || !/AUCUN SECRET DETECTE/.test(partielle.sortie)) {
      console.error(`\n  --- ${sousRacine}`);
      console.error(partielle.sortie);
    }
  }
} else {
  console.error(globale.sortie);
}

console.error('-'.repeat(78));
console.error(
  'VERDICT PORTE FERMÉE — secret détecté ou balayage impossible.\n' +
    '  EXPOSITION : la valeur est déjà dans l’historique git. La retirer du fichier ne\n' +
    '  suffit pas — révoquer la clé, puis purger l’historique.\n' +
    '  A_RISQUE : non suivi mais non ignoré ; il partirait au prochain `git add .`.\n' +
    `  Code de sortie du scanner : ${globale.code}`,
);
process.exit(1);
