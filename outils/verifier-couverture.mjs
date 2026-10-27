#!/usr/bin/env node
// =============================================================================
// PORTE DE QUALITÉ — seuils de couverture (ARCHI seuils_qualite)
// =============================================================================
// Les seuils ne sont PAS écrits ici : ils sont LUS dans ARCHI-GDV-001.json.
//   couverture_couche_metier        → paquets/moteur/src       (lignes ET branches)
//   couverture_projection_lignes    → paquets/moteur/src/projection
//   couverture_projection_branches  → paquets/moteur/src/projection
//   couverture_globale_plancher     → tout le périmètre mesuré
//
// La comparaison est NUMÉRIQUE et STRICTE : 94,9 < 95 ferme la porte. Un seuil
// qu'on arrondit vers le haut n'est plus un seuil.
//
// La porte se ferme aussi quand un périmètre ne contient AUCUNE instruction
// mesurée : un rapport qui ne mesure rien ne prouve rien.
//
// Usage  : node outils/verifier-couverture.mjs [--sans-execution] [--resume <fichier>]
// Sortie : 0 = seuils tenus, 1 = porte fermée
// =============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN_ARCHI = join(RACINE, '.claude', 'orchestration', 'contrats', 'ARCHI-GDV-001.json');
const DOSSIER_RAPPORT = join(RACINE, 'rapports', 'couverture');

const argument = (nom) => {
  const index = process.argv.indexOf(nom);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : null;
};
const CHEMIN_RESUME = resolve(argument('--resume') ?? join(DOSSIER_RAPPORT, 'coverage-summary.json'));
const sansExecution = process.argv.includes('--sans-execution');

// --- Seuils : lus dans le contrat, jamais choisis ici ------------------------
let seuils;
try {
  seuils = JSON.parse(readFileSync(CHEMIN_ARCHI, 'utf8')).seuils_qualite;
} catch (erreur) {
  console.error(`ÉCHEC — ARCHI-GDV-001.json illisible : ${erreur.message}`);
  process.exit(1);
}

function seuil(cle) {
  const valeur = seuils?.[cle];
  if (typeof valeur !== 'number') {
    console.error(
      `ÉCHEC — seuils_qualite.${cle} absent ou non numérique dans ARCHI-GDV-001.json. ` +
        `La porte refuse de comparer à un seuil inventé.`,
    );
    process.exit(1);
  }
  return valeur;
}

const PERIMETRES = [
  {
    nom: 'moteur (couche métier)',
    prefixe: 'paquets/moteur/src',
    exclure: [],
    lignes: seuil('couverture_couche_metier'),
    branches: seuil('couverture_couche_metier'),
    motif:
      'Le moteur est l’arbitre unique d’une partie en présentiel : aucun recours humain ' +
      'ne corrige un calcul faux pendant le jeu (ARCHI, priorité 2).',
  },
  {
    nom: 'moteur/projection (frontière de sécurité)',
    prefixe: 'paquets/moteur/src/projection',
    exclure: [],
    lignes: seuil('couverture_projection_lignes'),
    branches: seuil('couverture_projection_branches'),
    motif:
      'Chaque branche non exécutée est un chemin par lequel un secret peut sortir sans ' +
      'qu’aucun test ne l’ait vu (RG-01, priorité 1).',
  },
  {
    nom: 'global',
    prefixe: '',
    exclure: [],
    lignes: seuil('couverture_globale_plancher'),
    branches: null,
    motif: 'Plancher global.',
  },
];

// --- Exécution des tests sous c8 ---------------------------------------------
if (!sansExecution) {
  // Point d'entrée JS appelé directement : sous Windows, spawn d'un .cmd exige un
  // shell, et une porte de qualité n'a pas à passer par un interpréteur de plus.
  const binaire = join(RACINE, 'node_modules', 'c8', 'bin', 'c8.js');
  if (!existsSync(binaire)) {
    console.error(
      `ÉCHEC — c8 introuvable : ${binaire}\n` +
        '        Lancer `npm install` ; une porte qu’on ne peut pas exécuter ne protège rien.',
    );
    process.exit(1);
  }

  const execution = spawnSync(
    process.execPath,
    [
      binaire,
      '--all',
      '--extension=.ts',
      '--src=paquets/partage/src',
      '--src=paquets/moteur/src',
      '--src=applications/serveur/src',
      '--exclude=**/tests/**',
      '--exclude=**/dist/**',
      '--reporter=json-summary',
      '--reporter=text',
      `--report-dir=${DOSSIER_RAPPORT}`,
      process.execPath,
      '--conditions=gdv-source',
      '--test',
    ],
    { cwd: RACINE, stdio: 'inherit', shell: false },
  );

  if (execution.error) {
    console.error(`ÉCHEC — c8 n’a pas pu être lancé : ${execution.error.message}`);
    process.exit(1);
  }
  if ((execution.status ?? 1) !== 0) {
    console.error(
      `ÉCHEC — la suite de tests a échoué (code ${execution.status}). ` +
        'Aucune couverture n’est évaluée sur une suite rouge.',
    );
    process.exit(1);
  }
}

// --- Lecture du résumé --------------------------------------------------------
if (!existsSync(CHEMIN_RESUME)) {
  console.error(`ÉCHEC — résumé de couverture absent : ${CHEMIN_RESUME}`);
  process.exit(1);
}
const resume = JSON.parse(readFileSync(CHEMIN_RESUME, 'utf8'));

const normaliser = (chemin) =>
  resolve(chemin).slice(RACINE.length + 1).split(sep).join('/');

const fichiers = Object.entries(resume)
  .filter(([cle]) => cle !== 'total')
  .map(([cle, valeur]) => ({ chemin: normaliser(cle), mesures: valeur }));

function agreger(perimetre) {
  const retenus = fichiers.filter(
    (f) =>
      f.chemin.startsWith(perimetre.prefixe) &&
      !perimetre.exclure.some((e) => f.chemin.startsWith(e)),
  );
  const cumul = { lignes: { total: 0, couvert: 0 }, branches: { total: 0, couvert: 0 } };
  for (const f of retenus) {
    cumul.lignes.total += f.mesures.lines?.total ?? 0;
    cumul.lignes.couvert += f.mesures.lines?.covered ?? 0;
    cumul.branches.total += f.mesures.branches?.total ?? 0;
    cumul.branches.couvert += f.mesures.branches?.covered ?? 0;
  }
  return { fichiers: retenus.length, cumul };
}

const pourcentage = (couvert, total) => (total === 0 ? null : (couvert * 100) / total);
const formater = (valeur) => (valeur === null ? 'n/a' : `${valeur.toFixed(2)} %`);

console.log('');
console.log('PORTE — couverture : seuils lus dans ARCHI-GDV-001.json / seuils_qualite');
console.log('-'.repeat(78));

const echecs = [];
const mesures = [];

for (const perimetre of PERIMETRES) {
  const { fichiers: nb, cumul } = agreger(perimetre);
  const lignes = pourcentage(cumul.lignes.couvert, cumul.lignes.total);
  const branches = pourcentage(cumul.branches.couvert, cumul.branches.total);

  mesures.push({
    perimetre: perimetre.nom,
    fichiers: nb,
    lignes_mesurees: cumul.lignes.total,
    lignes_pct: lignes,
    seuil_lignes: perimetre.lignes,
    branches_pct: branches,
    seuil_branches: perimetre.branches,
  });

  console.log(
    `  ${perimetre.nom.padEnd(42)} fichiers=${String(nb).padStart(3)}  ` +
      `lignes=${formater(lignes).padStart(8)} (seuil ${perimetre.lignes})  ` +
      `branches=${formater(branches).padStart(8)}` +
      (perimetre.branches === null ? '' : ` (seuil ${perimetre.branches})`),
  );

  if (cumul.lignes.total === 0) {
    echecs.push(
      `${perimetre.nom} : AUCUNE instruction mesurée (${nb} fichier(s) dans le périmètre). ` +
        `Un rapport qui ne mesure rien ne prouve rien — la porte se ferme. ${perimetre.motif}`,
    );
    continue;
  }
  if (lignes < perimetre.lignes) {
    echecs.push(
      `${perimetre.nom} : lignes ${lignes.toFixed(2)} % < seuil ${perimetre.lignes} %. ` +
        perimetre.motif,
    );
  }
  if (perimetre.branches !== null) {
    if (cumul.branches.total === 0) {
      echecs.push(
        `${perimetre.nom} : aucune branche mesurée alors qu’un seuil de branches de ` +
          `${perimetre.branches} % est exigé.`,
      );
    } else if (branches < perimetre.branches) {
      echecs.push(
        `${perimetre.nom} : branches ${branches.toFixed(2)} % < seuil ${perimetre.branches} %. ` +
          perimetre.motif,
      );
    }
  }
}

console.log('-'.repeat(78));
if (echecs.length === 0) {
  console.log('VERDICT SEUILS TENUS');
  process.exit(0);
}
for (const echec of echecs) console.error(`  ÉCHEC ${echec}`);
console.error(`VERDICT PORTE FERMÉE — ${echecs.length} seuil(s) non tenu(s)`);
console.error(`  résumé lu : ${CHEMIN_RESUME}`);
console.error(`  mesures : ${JSON.stringify(mesures)}`);
process.exit(1);
