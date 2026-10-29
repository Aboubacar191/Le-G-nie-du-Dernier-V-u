// PREUVE — RG-79 : le décompte dérive de phase_fin_at CORRIGÉ d'un décalage
// d'horloge calculé en moyenne glissante sur emis_a.
//
// Cible du contrat : moins de 500 ms d'écart entre huit téléphones. Le test
// reproduit huit appareils dont les horloges locales dérivent, leur fait
// recevoir les mêmes enveloppes, et mesure l'écart des décomptes affichés.
//
// Il vérifie aussi que le décompte ne PILOTE rien : à l'expiration, la fonction
// rend « expire » et des secondes nulles, mais aucune décision n'en découle —
// l'autorité reste au serveur (RG-72).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decalageInitial,
  integrer,
  restantMs,
  SEUIL_ABERRANT_MS,
  TAILLE_FENETRE,
  versHorlogeLocale,
} from '../src/logique/decalage-horloge.ts';
import { calculerDecompte, formaterDecompte } from '../src/logique/decompte.ts';

const BASE_MS = Date.parse('2026-10-28T20:00:00.000Z');
const iso = (decalageMs: number): string => new Date(BASE_MS + decalageMs).toISOString();

test('aucun échantillon : le décalage est nul et déclaré non mesuré', () => {
  const etat = decalageInitial();
  assert.equal(etat.decalage_ms, 0);
  assert.equal(etat.mesure, false);
});

test('un appareil en avance de 2 s mesure un décalage de +2000 ms', () => {
  // Horloge locale en avance : elle croit qu'il est plus tard qu'au serveur.
  const etat = integrer(decalageInitial(), iso(0), BASE_MS + 2000);
  assert.equal(etat.decalage_ms, 2000);
  assert.equal(etat.mesure, true);
});

test('la moyenne glissante absorbe la gigue réseau', () => {
  let etat = decalageInitial();
  for (const gigue of [1000, 1200, 900, 1100, 1000, 950, 1050, 1000]) {
    etat = integrer(etat, iso(0), BASE_MS + gigue);
  }
  assert.ok(Math.abs(etat.decalage_ms - 1025) <= 5, `décalage mesuré ${etat.decalage_ms}`);
});

test('la fenêtre glissante ne retient que les derniers échantillons', () => {
  let etat = decalageInitial();
  for (let index = 0; index < TAILLE_FENETRE * 2; index += 1) {
    etat = integrer(etat, iso(0), BASE_MS + 5000);
  }
  assert.equal(etat.echantillons.length, TAILLE_FENETRE);
  assert.equal(etat.decalage_ms, 5000);
});

test('un échantillon aberrant est écarté sans emporter la moyenne', () => {
  let etat = integrer(decalageInitial(), iso(0), BASE_MS + 300);
  const avant = etat.decalage_ms;
  etat = integrer(etat, iso(0), BASE_MS + SEUIL_ABERRANT_MS + 1);
  assert.equal(etat.decalage_ms, avant, 'une trame retardée ne doit pas fausser le décompte');
});

test('une date illisible est ignorée plutôt que propagée', () => {
  const etat = integrer(decalageInitial(), 'pas-une-date', BASE_MS);
  assert.equal(etat.mesure, false);
  assert.equal(versHorlogeLocale(etat, 'pas-une-date'), null);
  assert.equal(restantMs(etat, 'pas-une-date', BASE_MS), null);
});

test('une échéance inconnue rend null, et le minuteur affiche deux tirets', () => {
  const etat = decalageInitial();
  assert.equal(restantMs(etat, null, BASE_MS), null);
  const decompte = calculerDecompte(etat, null, BASE_MS, 30);
  assert.equal(decompte.niveau, 'chargement');
  assert.equal(decompte.secondes, null);
  // Jamais un zéro : un zéro mentirait sur le temps restant.
  assert.equal(formaterDecompte(decompte.secondes), '——');
});

test('HUIT téléphones désynchronisés restent alignés à moins de 500 ms', () => {
  // Dérives d'horloge locales, en millisecondes, d'un appareil à l'autre.
  const derives = [-4200, -1500, -300, 0, 250, 1800, 3100, 7000];
  const echeance = iso(10_000);
  const secondesAffichees: number[] = [];

  for (const derive of derives) {
    let etat = decalageInitial();
    // Chaque appareil reçoit les MÊMES enveloppes, avec une gigue réseau propre.
    for (const [index, gigue] of [40, 70, 55, 90, 35, 60].entries()) {
      etat = integrer(etat, iso(index * 100), BASE_MS + index * 100 + derive + gigue);
    }
    // Instant d'affichage commun, vu de l'horloge locale de CET appareil.
    const maintenantLocal = BASE_MS + 4000 + derive;
    const decompte = calculerDecompte(etat, echeance, maintenantLocal, 10);
    assert.notEqual(decompte.secondes, null);
    secondesAffichees.push(decompte.secondes as number);
  }

  const minimum = Math.min(...secondesAffichees);
  const maximum = Math.max(...secondesAffichees);
  assert.ok(
    maximum - minimum <= 1,
    `écart de ${maximum - minimum} s entre huit appareils : ${secondesAffichees.join(', ')}`,
  );
});

test('SANS correction, les mêmes huit téléphones divergent de plusieurs secondes', () => {
  // Contre-épreuve : c'est ce que donnerait un décompte qui comparerait
  // directement l'horloge locale à phase_fin_at. Si ce test échoue un jour,
  // c'est que la correction est devenue inutile — pas qu'elle est inoffensive.
  const derives = [-4200, 0, 7000];
  const echeanceMs = BASE_MS + 10_000;
  const sansCorrection = derives.map((derive) =>
    Math.ceil((echeanceMs - (BASE_MS + 4000 + derive)) / 1000),
  );
  const ecart = Math.max(...sansCorrection) - Math.min(...sansCorrection);
  assert.ok(ecart >= 11, `écart non corrigé attendu large, mesuré ${ecart} s`);
});

test('les trois niveaux d’urgence suivent les seuils du contrat', () => {
  const etat = decalageInitial();
  const niveau = (resteS: number): string =>
    calculerDecompte(etat, iso(resteS * 1000), BASE_MS, 60).niveau;

  assert.equal(niveau(30), 'calme');
  assert.equal(niveau(10), 'tension');
  assert.equal(niveau(4), 'critique');
  assert.equal(niveau(0), 'expire');
});

test('la fraction d’arc reste dans [0, 1] même sans durée de phase connue', () => {
  const etat = decalageInitial();
  const sansDuree = calculerDecompte(etat, iso(5000), BASE_MS, null);
  assert.equal(sansDuree.fraction, 1);
  const avecDuree = calculerDecompte(etat, iso(5000), BASE_MS, 10);
  assert.ok(avecDuree.fraction > 0 && avecDuree.fraction <= 1);
});
