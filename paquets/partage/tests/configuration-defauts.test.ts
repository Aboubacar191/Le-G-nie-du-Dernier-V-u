// RG-60 / CA-46 : les 21 paramètres d'équilibrage vivent dans un fichier unique.
// Ce test compare defauts.json à parametres_configuration de SPEC-GDV-001.json :
// un paramètre oublié, ajouté ou renommé ferme la porte.
//
// Il ne vérifie AUCUNE règle de jeu : seulement que la configuration couvre
// exactement ce que la SPEC énumère, et qu'aucune valeur n'est un flottant
// (ADR-TL-14 : aucun flottant ne traverse le moteur, la base ou le fil).

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_DEPOT = resolve(ICI, '..', '..', '..');

const spec = JSON.parse(
  readFileSync(join(RACINE_DEPOT, '.claude', 'orchestration', 'contrats', 'SPEC-GDV-001.json'), 'utf8'),
);
const defauts = JSON.parse(readFileSync(resolve(ICI, '..', 'src', 'config', 'defauts.json'), 'utf8'));

const attendus = Object.keys(spec.parametres_configuration).filter((cle) => !cle.startsWith('_'));

test('defauts.json porte exactement les paramètres de la SPEC', () => {
  const obtenus = Object.keys(defauts);
  assert.deepEqual(
    obtenus.slice().sort(),
    attendus.slice().sort(),
    'écart entre defauts.json et SPEC parametres_configuration',
  );
});

test('les 21 paramètres de configuration sont présents', () => {
  assert.equal(attendus.length, 21, 'la SPEC n’énumère plus 21 paramètres');
  assert.equal(Object.keys(defauts).length, 21);
});

test('aucune valeur de configuration n’est un flottant (ADR-TL-14)', () => {
  const entier = (valeur: unknown): boolean => typeof valeur === 'number' && Number.isInteger(valeur);
  for (const [cle, valeur] of Object.entries(defauts)) {
    if (Array.isArray(valeur)) {
      assert.equal(valeur.length, 2, `${cle} : un rationnel a exactement deux termes`);
      assert.ok(valeur.every(entier), `${cle} : rationnel à termes entiers`);
      continue;
    }
    if (valeur !== null && typeof valeur === 'object') {
      for (const [sousCle, sousValeur] of Object.entries(valeur)) {
        assert.ok(entier(sousValeur), `${cle}.${sousCle} doit être un entier`);
      }
      continue;
    }
    assert.ok(entier(valeur), `${cle} doit être un entier`);
  }
});

test('les durées de phases couvrent les phases minutées du protocole', () => {
  const api = JSON.parse(
    readFileSync(resolve(ICI, '..', 'src', 'contrat', 'api.json'), 'utf8'),
  );
  const requises: string[] =
    api.components.schemas.ConfigJeuPublique.properties.durees_phases_s.required;
  assert.deepEqual(Object.keys(defauts.durees_phases_s).slice().sort(), requises.slice().sort());
});
