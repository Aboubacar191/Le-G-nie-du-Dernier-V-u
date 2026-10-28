// Test mécanique exigé par ARCHI seuils_qualite.interdits_mecaniques (v1.1.0) :
//
//   « CHAMPS_SECRETS_PAR_ENTITE de paquets/partage/src/protocole/visibilite.ts
//     est comparé, ENTITÉ PAR ENTITÉ, aux modele_donnees[].champs_secrets du
//     présent contrat lu depuis ARCHI-GDV-001.json. Égalité d'ensembles exigée
//     sur les 13 entités. Le test échoue sur tout écart, dans les deux sens. »
//
// Sans ce test, le registre qualifié est une recopie manuelle, c'est-à-dire une
// source de divergence de plus. Précédent d'outillage : tests/contrat-api.test.ts
// fait déjà cela pour api.json.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CHAMPS_SECRETS, CHAMPS_SECRETS_PAR_ENTITE } from '../src/protocole/visibilite.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_DEPOT = resolve(ICI, '..', '..', '..');

interface EntreeModele {
  readonly entite: string;
  readonly champs_secrets?: readonly string[];
}

const archi = JSON.parse(
  readFileSync(
    join(RACINE_DEPOT, '.claude', 'orchestration', 'contrats', 'ARCHI-GDV-001.json'),
    'utf8',
  ),
) as { modele_donnees: readonly EntreeModele[] };

const NOMBRE_ENTITES = 13;

test('les 13 entités du contrat sont exactement celles du registre du code', () => {
  const duContrat = archi.modele_donnees.map((entree) => entree.entite);
  const duCode = Object.keys(CHAMPS_SECRETS_PAR_ENTITE);
  assert.equal(duContrat.length, NOMBRE_ENTITES);
  assert.deepEqual([...duCode].sort(), [...duContrat].sort());
});

test('pour chaque entité, l’ensemble des champs secrets est ÉGAL à celui du contrat', () => {
  const registre = CHAMPS_SECRETS_PAR_ENTITE as Readonly<Record<string, readonly string[]>>;
  for (const entree of archi.modele_donnees) {
    const attendus = [...(entree.champs_secrets ?? [])].sort();
    const obtenus = [...(registre[entree.entite] ?? [])].sort();
    assert.deepEqual(
      obtenus,
      attendus,
      `écart sur l’entité ${entree.entite} :\n  contrat : ${attendus.join(', ')}\n` +
        `  code    : ${obtenus.join(', ')}`,
    );
  }
});

test('le dénombrement du contrat est exact : 40 couples, 39 noms distincts', () => {
  // ARCHI registre_champs_secrets.denombrement_au_2026_10_27 : « 13 entités,
  // 40 couples (entite, champ), qui s'effondrent en 39 noms de champs distincts
  // une fois aplatis. L'aplatissement perd donc de l'information. »
  const couples = Object.values(CHAMPS_SECRETS_PAR_ENTITE).flat();
  assert.equal(couples.length, 40, 'nombre de couples (entite, champ)');
  assert.equal(CHAMPS_SECRETS.length, 39, 'nombre de noms distincts après aplatissement');
  assert.ok(
    couples.length > CHAMPS_SECRETS.length,
    'si l’aplatissement ne perdait rien, la forme qualifiée serait inutile',
  );
});

test('le nom qui s’effondre est bien joueur_id, secret dans DEUX entités', () => {
  const porteurs = Object.entries(CHAMPS_SECRETS_PAR_ENTITE)
    .filter(([, champs]) => (champs as readonly string[]).includes('joueur_id'))
    .map(([entite]) => entite);
  assert.deepEqual(
    [...porteurs].sort(),
    ['journal_commandes', 'signatures_dernier_voeu'],
    'joueur_id est secret dans ces deux entités, et public ailleurs',
  );
});

test('l’union à plat est gelée : aucun doublon, ordre stable', () => {
  assert.equal(new Set(CHAMPS_SECRETS).size, CHAMPS_SECRETS.length);
  assert.ok(Object.isFrozen(CHAMPS_SECRETS));
});
