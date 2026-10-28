// CA-46 — US-17. Étant donné le code source du moteur, quand on y recherche les
// littéraux 12, 3, 2, 15, 10 utilisés COMME RÈGLES DE JEU, alors aucun
// n'apparaît en dur dans la logique : tous proviennent de la configuration.
// (RG-60)
//
// Ce test est mécanique et porte sur les SOURCES. Il double la règle ESLint
// no-magic-numbers, qui se désactive avec un commentaire ; lui ne se désactive
// qu'en le supprimant, ce qui se voit dans un diff.
//
// Deux formes de littéral sont tolérées, et une seule raison pour chacune :
//   · 0 et 1, que no-magic-numbers admet déjà (indices, incréments, bornes
//     structurelles d'un intervalle) ;
//   · une constante NOMMÉE en tête de module, qui porte alors son motif dans
//     son nom et dans son commentaire. La règle de l'ARCHI n'interdit pas les
//     nombres : elle interdit les nombres ANONYMES.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAQUET = resolve(ICI, '..', '..');
const SOURCES = join(PAQUET, 'src');

/** Les cinq valeurs d'équilibrage que CA-46 nomme explicitement. */
const VALEURS_SURVEILLEES = [12, 3, 2, 15, 10];

function fichiersTs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersTs(chemin));
    else if (entree.endsWith('.ts')) trouves.push(chemin);
  }
  return trouves;
}

/** Une ligne de déclaration de constante nommée, ou de commentaire. */
function estLigneAutorisee(ligne: string): boolean {
  const nue = ligne.trim();
  if (nue.startsWith('//') || nue.startsWith('*') || nue.startsWith('/*')) return true;
  // const NOM_EN_MAJUSCULES = <nombre> ;  (éventuellement typé, ou en rationnel)
  return /^(export\s+)?const\s+[A-Z][A-Z0-9_]*(\s*:\s*[A-Za-z<>[\]|\s]+)?\s*=\s*[[]?[-\d,\s\]]+;?$/.test(
    nue,
  );
}

test('CA-46 : aucun des littéraux 12, 3, 2, 15, 10 n’est anonyme dans le moteur', () => {
  const fautes: string[] = [];

  for (const fichier of fichiersTs(SOURCES)) {
    const lignes = readFileSync(fichier, 'utf8').split('\n');
    lignes.forEach((ligne, index) => {
      if (estLigneAutorisee(ligne)) return;
      // On retire les chaînes de caractères : un message d'erreur peut citer
      // une valeur sans qu'elle gouverne un calcul.
      const sansChaines = ligne.replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``');
      for (const valeur of VALEURS_SURVEILLEES) {
        const motif = new RegExp(`(?<![\\w.])${valeur}(?![\\w.])`);
        if (!motif.test(sansChaines)) continue;
        fautes.push(
          `${relative(PAQUET, fichier)}:${index + 1} — littéral ${valeur} : ${ligne.trim()}`,
        );
      }
    });
  }

  assert.deepEqual(
    fautes,
    [],
    `valeurs d’équilibrage en dur dans le moteur (RG-60) :\n${fautes.join('\n')}`,
  );
});

test('CA-46 : les valeurs d’équilibrage sont bien dans defauts.json', () => {
  const defauts = JSON.parse(
    readFileSync(resolve(PAQUET, '..', 'partage', 'src', 'config', 'defauts.json'), 'utf8'),
  ) as Record<string, unknown>;
  assert.equal(defauts.pieces_initiales, 12);
  assert.equal(defauts.objectif_par_joueur, 3);
  assert.equal(defauts.multiplicateur_recompense, 2);
  assert.equal(defauts.recompense_signature_dernier_voeu, 15);
  assert.equal(defauts.bonus_mission_reussie, 10);
});
