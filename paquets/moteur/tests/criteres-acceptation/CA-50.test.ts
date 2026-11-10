// CA-50 — US-11. Étant donné une manche quelconque, quand on tente d'injecter
// une action d'EXÉCUTION, de RÉVÉLATION ou de DISTRIBUTION depuis un client,
// alors aucune de ces opérations n'est exposée comme commande client : elles
// n'existent que côté serveur.
//
// Le critère est vérifié sur trois plans, parce qu'un seul ne suffirait pas :
//   1. le CONTRAT n'énumère aucune commande de ce genre ;
//   2. la TABLE DES GESTIONNAIRES du moteur n'en porte aucune ;
//   3. un type inconnu envoyé malgré tout est refusé, pas ignoré.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPERATIONS_SANS_COMMANDE,
  TYPES_COMMANDE,
  estTypeCommande,
  type TypeCommande,
} from '@gdv/partage';
import { GESTIONNAIRES } from '@gdv/moteur';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..', '..', '..', '..');

/** Mots qui ne doivent apparaître dans AUCUN nom de commande. */
const INTERDITS = [
  'execut',
  'reveler',
  'revelation',
  'distribu',
  'pipeline',
  'score',
  'solde',
  'clause',
  'role',
  'mission',
  'tirer',
  'config',
];

test('CA-50 : le contrat n’énumère aucune commande d’exécution, de révélation ou de distribution', () => {
  const contrat = JSON.parse(
    readFileSync(
      resolve(RACINE, '.claude', 'orchestration', 'contrats', 'API-GDV-001.json'),
      'utf8',
    ),
  ) as {
    components: { schemas: { EnveloppeCommande: { properties: { type: { enum: string[] } } } } };
  };
  const types = contrat.components.schemas.EnveloppeCommande.properties.type.enum;

  assert.deepEqual([...types].sort(), [...TYPES_COMMANDE].sort(), 'le code suit le contrat');
  for (const type of types) {
    for (const interdit of INTERDITS) {
      assert.ok(
        !type.includes(interdit),
        `la commande « ${type} » évoque une opération réservée au serveur (${interdit})`,
      );
    }
  }
  assert.equal(types.length, 14, 'quatorze commandes, pas une de plus');
});

test('CA-50 : la table des gestionnaires du moteur ne porte que les commandes du contrat', () => {
  const gestionnaires = Object.keys(GESTIONNAIRES);
  // authentifier est un acte de TRANSPORT : il n'a pas de gestionnaire de jeu.
  assert.deepEqual(
    [...gestionnaires, 'authentifier'].sort(),
    [...TYPES_COMMANDE].sort(),
  );
  for (const nom of gestionnaires) {
    for (const interdit of INTERDITS) {
      assert.ok(!nom.includes(interdit), `le gestionnaire ${nom} évoque ${interdit}`);
    }
  }
});

test('CA-50 : les opérations réservées sont inscrites comme interdites', () => {
  assert.ok(OPERATIONS_SANS_COMMANDE.length >= 7);
  const liste = OPERATIONS_SANS_COMMANDE.join(' ');
  for (const attendu of ['execution', 'revelation', 'distribution', 'scores', 'solde']) {
    assert.ok(liste.includes(attendu), `la liste doit mentionner ${attendu}`);
  }
});

test('CA-50 : un type de commande inconnu n’est pas reconnu par le validateur', () => {
  for (const type of [
    'executer_pipeline',
    'emettre_revelation',
    'distribuer_roles',
    'calculer_scores',
    'modifier_solde',
    'lire_etat_autre_joueur',
  ]) {
    assert.equal(estTypeCommande(type), false, `${type} ne doit pas être une commande`);
    assert.ok(!(type in GESTIONNAIRES), `${type} ne doit pas avoir de gestionnaire`);
  }
});

test('CA-50 : authentifier n’est pas traitée comme une commande de jeu par le moteur', () => {
  // Elle est obligatoirement la première trame de la connexion et relève du
  // transport : si elle parvient malgré tout au moteur, elle est REFUSÉE.
  assert.ok(!('authentifier' in GESTIONNAIRES));
  assert.equal(estTypeCommande('authentifier' as TypeCommande), true, 'elle existe au contrat');
});
