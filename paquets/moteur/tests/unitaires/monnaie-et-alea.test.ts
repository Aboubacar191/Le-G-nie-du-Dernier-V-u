// Arithmétique entière et aléa injecté : les deux fondations du moteur.
//
// Elles sont testées séparément du jeu parce qu'une erreur d'arrondi ou un
// générateur non reproductible ne se voit pas dans un scénario — elle se voit
// trois manches plus loin, sur un montant qui ne tombe pas juste.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  complement,
  creerAleaSfc32,
  dateCivile,
  plafond,
  plafonnerAuSolde,
  plancher,
  prorata,
  somme,
  unPlus,
  versIso,
} from '@gdv/moteur';
import { ORDRE_CONSOMMATION_ALEA } from '@gdv/moteur';

test('plancher : division exacte et division avec reste', () => {
  assert.equal(plancher(40, [2, 3]), 26);
  assert.equal(plancher(42, [2, 3]), 28);
  assert.equal(plancher(0, [2, 3]), 0);
  assert.equal(plancher(7, [1, 2]), 3);
  assert.equal(plancher(8, [1, 2]), 4);
  assert.equal(plancher(5, [0, 3]), 0, 'un numérateur nul donne zéro');
});

test('plafond : division exacte et division avec reste', () => {
  assert.equal(plafond(4, [3, 2]), 6, 'plafond(4 × 1,5)');
  assert.equal(plafond(5, [3, 2]), 8, 'plafond(7,5)');
  assert.equal(plafond(6, [1, 2]), 3, 'division exacte : pas d’arrondi parasite');
  assert.equal(plafond(0, [3, 2]), 0);
});

test('un dénominateur nul est un défaut de configuration, pas un résultat', () => {
  assert.throws(() => plancher(4, [1, 0]), /dénominateur nul/);
  assert.throws(() => plafond(4, [1, 0]), /dénominateur nul/);
});

test('complement et unPlus : les deux transformations de fraction du jeu', () => {
  assert.deepEqual(complement([1, 3]), [2, 3], 'le génie garde un tiers, il reste deux tiers');
  assert.deepEqual(complement([1, 2]), [1, 2]);
  assert.deepEqual(unPlus([1, 2]), [3, 2], 'un plus un demi');
  assert.deepEqual(unPlus([1, 3]), [4, 3]);
});

test('plafonnerAuSolde : un prélèvement involontaire ne dépasse jamais le solde', () => {
  assert.equal(plafonnerAuSolde(10, 3), 3);
  assert.equal(plafonnerAuSolde(3, 10), 3);
  assert.equal(plafonnerAuSolde(5, 5), 5, 'égalité : rien n’est perdu');
  assert.equal(plafonnerAuSolde(7, 0), 0);
});

test('prorata : une somme de poids NULLE ne verse rien, et ne divise pas par zéro', () => {
  assert.equal(prorata(40, 0, 0), 0);
  assert.equal(prorata(40, 4, 26), 6);
  assert.equal(prorata(40, 6, 26), 9);
  assert.equal(prorata(0, 4, 26), 0);
});

test('somme : liste vide, liste d’un terme, liste quelconque', () => {
  assert.equal(somme([]), 0);
  assert.equal(somme([7]), 7);
  assert.equal(somme([1, 2, 3, 4]), 10);
});

test('l’aléa est reproductible à la graine, et différent d’une graine à l’autre', () => {
  const premier = creerAleaSfc32('graine-a');
  const second = creerAleaSfc32('graine-a');
  const autre = creerAleaSfc32('graine-b');

  const suite = (alea: ReturnType<typeof creerAleaSfc32>): number[] =>
    Array.from({ length: 20 }, () => alea.entier(0, 999));

  const a = suite(premier);
  assert.deepEqual(suite(second), a, 'même graine, même suite');
  assert.notDeepEqual(suite(autre), a, 'graine différente, suite différente');
});

test('une graine vide est refusée : le déterminisme exige une graine explicite', () => {
  assert.throws(() => creerAleaSfc32(''), /Graine vide/);
});

test('entier : bornes incluses, intervalle d’un seul point, intervalle vide refusé', () => {
  const alea = creerAleaSfc32('bornes');
  for (let essai = 0; essai < 200; essai += 1) {
    const valeur = alea.entier(3, 5);
    assert.ok(valeur >= 3 && valeur <= 5, `valeur hors bornes : ${valeur}`);
  }
  assert.equal(alea.entier(7, 7), 7, 'min === max');
  assert.throws(() => alea.entier(5, 2), /Intervalle vide/);
});

test('choisir : rend un élément de la liste, et refuse une liste vide', () => {
  const alea = creerAleaSfc32('choisir');
  const liste = ['a', 'b', 'c'] as const;
  for (let essai = 0; essai < 50; essai += 1) {
    assert.ok(liste.includes(alea.choisir(liste)));
  }
  assert.throws(() => alea.choisir([]), /liste vide/);
});

test('melanger : permutation, sans modifier l’original', () => {
  const alea = creerAleaSfc32('melanger');
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const melange = alea.melanger(original);
  assert.deepEqual([...melange].sort((a, b) => a - b), original, 'c’est bien une permutation');
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8], 'l’original est intact');
  assert.deepEqual(alea.melanger([]), [], 'liste vide : permutation vide');
  assert.deepEqual(alea.melanger([9]), [9], 'un seul élément : rien à permuter');
});

test('booleen : les deux valeurs sortent', () => {
  const alea = creerAleaSfc32('booleen');
  const tirages = Array.from({ length: 100 }, () => alea.booleen());
  assert.ok(tirages.includes(true));
  assert.ok(tirages.includes(false));
});

test('l’ordre de consommation de l’aléa est documenté comme donnée', () => {
  assert.deepEqual(
    [...ORDRE_CONSOMMATION_ALEA],
    ['roles', 'missions', 'mode_avance', 'clause', 'porteur', 'variante_formulation'],
  );
});

test('versIso : horodatage ISO 8601 UTC calculé sans Date', () => {
  assert.equal(versIso(0), '1970-01-01T00:00:00.000Z');
  assert.equal(versIso(1), '1970-01-01T00:00:00.001Z');
  assert.equal(versIso(1_700_000_000_000), '2023-11-14T22:13:20.000Z');
  assert.equal(versIso(1_762_000_000_000), '2025-11-01T12:26:40.000Z');
  // Années bissextiles et fin de mois : les pièges du calendrier grégorien.
  assert.equal(versIso(Date.UTC(2024, 1, 29, 23, 59, 59, 999)), '2024-02-29T23:59:59.999Z');
  assert.equal(versIso(Date.UTC(2000, 1, 29)), '2000-02-29T00:00:00.000Z');
  assert.equal(versIso(Date.UTC(1900, 2, 1)), '1900-03-01T00:00:00.000Z');
  assert.equal(versIso(Date.UTC(2026, 11, 31, 12, 0, 0, 0)), '2026-12-31T12:00:00.000Z');
});

test('versIso concorde avec Date.toISOString sur un échantillon étendu', () => {
  // Le moteur n'a pas le droit d'utiliser Date ; le TEST, lui, s'en sert comme
  // ORACLE. C'est la bonne place pour cette dépendance.
  for (let jour = 0; jour < 4000; jour += 7) {
    const ms = jour * 86_400_000 + 3_723_456;
    assert.equal(versIso(ms), new Date(ms).toISOString(), `jour ${jour}`);
  }
});

test('dateCivile : conversion jours → date, aux deux bouts du calendrier', () => {
  assert.deepEqual(dateCivile(0), { annee: 1970, mois: 1, jour: 1 });
  assert.deepEqual(dateCivile(-1), { annee: 1969, mois: 12, jour: 31 });
  assert.deepEqual(dateCivile(19_000), { annee: 2022, mois: 1, jour: 8 });
});
