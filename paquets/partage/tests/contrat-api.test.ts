// ARCHI conventions.arborescence_depot / paquets/partage :
//   « src/contrat/api.json — copie exacte de API-GDV-001.json, importée ;
//     un test échoue si les deux divergent. »
//
// La copie existe pour que le paquet partagé soit autoporteur à l'exécution,
// sans dépendre de l'arborescence d'orchestration. Mais une copie qui dérive de
// son original est pire que pas de copie : backend et frontend se mettraient
// d'accord sur un contrat que le tech-lead n'a pas signé.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_DEPOT = resolve(ICI, '..', '..', '..');

const CHEMIN_ORIGINAL = join(
  RACINE_DEPOT,
  '.claude',
  'orchestration',
  'contrats',
  'API-GDV-001.json',
);
const CHEMIN_COPIE = resolve(ICI, '..', 'src', 'contrat', 'api.json');

test('la copie du contrat de protocole est identique à l’original, octet à octet', () => {
  const original = readFileSync(CHEMIN_ORIGINAL);
  const copie = readFileSync(CHEMIN_COPIE);

  assert.ok(
    original.equals(copie),
    `paquets/partage/src/contrat/api.json diverge de API-GDV-001.json.\n` +
      `  original : ${original.length} octets (${CHEMIN_ORIGINAL})\n` +
      `  copie    : ${copie.length} octets (${CHEMIN_COPIE})\n` +
      `  Le code n'est jamais la source de vérité : recopier l'original, ` +
      `ne pas amender la copie.`,
  );
});

test('la version du protocole de la copie est celle de l’original', () => {
  const original = JSON.parse(readFileSync(CHEMIN_ORIGINAL, 'utf8'));
  const copie = JSON.parse(readFileSync(CHEMIN_COPIE, 'utf8'));
  assert.equal(copie.info.version, original.info.version);
});
