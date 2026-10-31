// PREUVE — les jetons de style sont GÉNÉRÉS depuis DESIGN-GDV-001.json, et la
// génération est déterministe.
//
// Les variables CSS ne sont pas rédigées : elles sont compilées. Ce test
// relance le compilateur en mode vérification et échoue si un fichier généré a
// divergé du contrat — soit qu'on l'ait retouché à la main, soit que le contrat
// ait bougé sans recompilation. Dans les deux cas, l'écran et le contrat ne
// disent plus la même chose, et c'est exactement ce qu'on ne veut pas découvrir
// au playtest.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { DUREES_MS, JETONS_COULEUR, MINUTEUR, RUPTURES, SECRET, THEMES } from '../src/styles/jetons.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..', '..', '..');
const COMPILATEUR = resolve(RACINE, 'outils', 'compiler-jetons.mjs');
const DESIGN = resolve(RACINE, '.claude', 'orchestration', 'contrats', 'DESIGN-GDV-001.json');
const CSS = resolve(ICI, '..', 'src', 'styles', 'jetons.css');

interface Tokens {
  readonly couleur: {
    readonly theme_clair: Record<string, string>;
    readonly theme_sombre: Record<string, string>;
  };
  readonly espacement: Record<string, string>;
  readonly cible: Record<string, string>;
  readonly minuteur: Record<string, number>;
  readonly secret: Record<string, string | number>;
  readonly rupture: Record<string, string>;
  readonly duree: Record<string, string>;
}

const contrat = (JSON.parse(readFileSync(DESIGN, 'utf8')) as { tokens: Tokens }).tokens;

test('les fichiers générés correspondent au contrat, à l’octet', () => {
  const execution = spawnSync(process.execPath, [COMPILATEUR, '--verifier'], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  assert.equal(
    execution.status,
    0,
    `jetons divergents du contrat :\n${execution.stderr}${execution.stdout}`,
  );
});

test('les fichiers générés portent l’avertissement « GÉNÉRÉ »', () => {
  const css = readFileSync(CSS, 'utf8');
  assert.ok(css.includes('GÉNÉRÉ — NE PAS MODIFIER À LA MAIN'), 'en-tête absent du CSS');
  assert.ok(css.includes('compiler-jetons.mjs'), 'le générateur doit être nommé');
  assert.ok(css.includes('npm run jetons'), 'la commande de régénération doit être nommée');
});

test('les 29 noms de couleur du contrat sont exposés en TypeScript', () => {
  const attendus = Object.keys(contrat.couleur.theme_clair).filter((cle) => !cle.startsWith('_'));
  assert.deepEqual([...JETONS_COULEUR], attendus);
  assert.equal(JETONS_COULEUR.length, 29);
});

test('les DEUX thèmes sont des livrables égaux, pas une option', () => {
  assert.deepEqual([...THEMES], ['clair', 'sombre']);
  const clair = Object.keys(contrat.couleur.theme_clair).filter((c) => !c.startsWith('_'));
  const sombre = Object.keys(contrat.couleur.theme_sombre).filter((c) => !c.startsWith('_'));
  assert.deepEqual(sombre, clair, 'les deux thèmes portent les mêmes noms sémantiques');
});

test('chaque jeton du contrat se retrouve dans le CSS, valeur comprise', () => {
  const css = readFileSync(CSS, 'utf8');
  for (const [nom, valeur] of Object.entries(contrat.couleur.theme_clair)) {
    if (nom.startsWith('_')) continue;
    assert.ok(css.includes(`--gdv-${nom}: ${valeur};`), `couleur claire ${nom} absente`);
  }
  for (const [nom, valeur] of Object.entries(contrat.couleur.theme_sombre)) {
    if (nom.startsWith('_')) continue;
    assert.ok(css.includes(`--gdv-${nom}: ${valeur};`), `couleur sombre ${nom} absente`);
  }
  for (const [pas, valeur] of Object.entries(contrat.espacement)) {
    if (pas.startsWith('_')) continue;
    assert.ok(css.includes(`--gdv-espacement-${pas}: ${valeur};`), `espacement ${pas} absent`);
  }
});

test('les références inter-jetons sont RÉSOLUES, jamais laissées en texte', () => {
  const css = readFileSync(CSS, 'utf8');
  // « cible.confortable » dans une valeur CSS serait invalide : le compilateur
  // doit l'avoir remplacée par var(--gdv-cible-confortable).
  assert.ok(!/:\s*[a-z]+\.[a-z_]+;/u.test(css), 'une référence de jeton est restée en texte');
  assert.ok(css.includes('--gdv-hauteur-bandeau-phase: var(--gdv-cible-confortable);'));
  assert.ok(css.includes('--gdv-role-corps: var(--gdv-taille-16);'));
});

test('les points de rupture sortent en TypeScript, et PAS en variable CSS', () => {
  // Contrainte de la spécification CSS, pas une préférence : une variable CSS
  // ne fonctionne pas dans une règle @media.
  const css = readFileSync(CSS, 'utf8');
  for (const nom of Object.keys(contrat.rupture)) {
    if (nom.startsWith('_')) continue;
    assert.ok(!css.includes(`--gdv-rupture-${nom}`), `rupture ${nom} ne doit pas être en CSS`);
  }
  assert.deepEqual(
    Object.keys(RUPTURES),
    Object.keys(contrat.rupture).filter((c) => !c.startsWith('_')),
  );
});

test('les seuils du minuteur viennent du contrat, pas du code', () => {
  assert.equal(MINUTEUR['seuil-tension-s'], contrat.minuteur.seuil_tension_s);
  assert.equal(MINUTEUR['seuil-critique-s'], contrat.minuteur.seuil_critique_s);
  assert.equal(MINUTEUR['pas-rafraichissement-ms'], contrat.minuteur.pas_rafraichissement_ms);
});

test('les durées de CONFIDENTIALITÉ ne sont pas annulées sous mouvement réduit', () => {
  const css = readFileSync(CSS, 'utf8');
  const bloc = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  // Ce sont des règles de secret, pas des animations.
  for (const nom of ['remasquage-apres-contact', 'revelation-minutee', 'revelation-maintien-max']) {
    assert.ok(!bloc.includes(`--gdv-duree-${nom}`), `${nom} ne doit pas être réduite`);
  }
  for (const nom of ['rapide', 'normale', 'lente']) {
    assert.ok(bloc.includes(`--gdv-duree-${nom}: 0ms;`), `transition ${nom} non annulée`);
  }
  // Et les valeurs fonctionnelles restent celles du contrat.
  assert.equal(DUREES_MS['revelation-maintien-max'], 4000);
  assert.equal(DUREES_MS['remasquage-apres-contact'], 1500);
});

// RETIRÉ — « la fenêtre de lecture du secret tient sous le plafond de surface ».
//
// Ce test comparait (96 × 64) / (360 × 640) = 2,67 % au jeton
// surface-lisible-max-ratio = 9 %. Les trois nombres sortaient du MÊME contrat
// de conception : l'assertion ne pouvait pas échouer, parce qu'elle vérifiait
// que le designer n'avait pas contredit le designer. Elle n'a jamais touché une
// ligne de code, et elle a donné un vert franc à un dispositif dont l'enveloppe
// n'était bornée par aucune règle CSS — une hauteur MINIMALE laissait la lucarne
// grandir avec son contenu. Elle validait précisément le cas qu'elle prétendait
// exclure.
//
// Remplacé par applications/client/tests/fenetre-de-lecture.test.ts, qui mesure
// la CONSOMMATION EFFECTIVE : les jetons sont-ils émis en CSS, consommés par un
// composant réel, et la géométrie écrite dans ce composant borne-t-elle la
// surface ? La surface y est recalculée depuis les déclarations CSS réelles, en
// résolvant chaque var() dans jetons.css.
//
// Ce qui reste légitimement ici relève du contrat et de sa compilation : que les
// deux jetons de géométrie soient bien des longueurs en pixels, et qu'ils
// sortent en CSS — sans quoi aucune feuille de style ne pourrait les lire.
test('les jetons de la fenêtre de lecture sont des longueurs, et sortent en CSS', () => {
  const css = readFileSync(CSS, 'utf8');
  for (const [cle, variable] of [
    ['largeur-fenetre-lecture', '--gdv-secret-largeur-fenetre'],
    ['hauteur-fenetre-lecture', '--gdv-secret-hauteur-fenetre'],
  ] as const) {
    const valeur = String(SECRET[cle]);
    assert.match(valeur, /^\d+px$/u, `secret.${cle} doit être une longueur en pixels`);
    assert.ok(
      css.includes(`${variable}: ${valeur};`),
      `${variable} doit être émis en CSS : jetons.ts n'est pas lu par une feuille de style`,
    );
  }
  // Le plafond de surface reste un nombre sans unité : il sert au calcul fait
  // dans fenetre-de-lecture.test.ts, et n'a pas de sens en CSS.
  assert.equal(typeof SECRET['surface-lisible-max-ratio'], 'number');
});

test('aucune cible interactive du contrat ne descend sous 48 px', () => {
  for (const [nom, valeur] of Object.entries(contrat.cible)) {
    if (nom.startsWith('_')) continue;
    const pixels = Number.parseInt(valeur, 10);
    assert.ok(pixels >= 48, `cible ${nom} = ${valeur}, sous le minimum du contrat`);
  }
});
