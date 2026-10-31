// PREUVE — la fenêtre de lecture du secret EXISTE, et son enveloppe est TENUE.
//
// Ce fichier remplace un test tautologique. L'ancien contrôle, dans
// jetons-generes.test.ts, s'écrivait ainsi :
//
//     const largeur = Number.parseInt(SECRET['largeur-fenetre-lecture']);   // 96
//     const hauteur = Number.parseInt(SECRET['hauteur-fenetre-lecture']);   // 64
//     const plafond = Number(SECRET['surface-lisible-max-ratio']);          // 0,09
//     assert.ok((largeur * hauteur) / (360 * 640) <= plafond);              // 2,67 %
//
// Les trois nombres venaient du MÊME contrat de conception. 96 × 64 tient sous
// 9 % parce que le designer a écrit 96, 64 et 0,09 : l'assertion ne pouvait pas
// échouer, et elle validait précisément le cas qu'elle prétendait exclure — un
// dispositif dont aucune ligne de code n'applique l'enveloppe. Un test qui ne
// peut pas rougir n'est pas une porte, c'est une décoration.
//
// Ce que mesure ce fichier à la place : la CONSOMMATION EFFECTIVE. Les deux
// jetons sont-ils émis en CSS, consommés par un composant réel, et la géométrie
// écrite dans ce composant borne-t-elle vraiment la surface exposée ? La surface
// est recalculée depuis les déclarations CSS RÉELLES, en résolvant chaque var()
// dans jetons.css — pas depuis les nombres du contrat. Si quelqu'un écrit une
// largeur en dur, retire une borne, pointe un autre jeton ou laisse le contenu
// déborder, le calcul change et le test rougit.
//
// Pourquoi c'est de rang 1. Le serveur est étanche, c'est prouvé par ailleurs :
// aucun secret d'autrui n'atteint un appareil. Le seul canal de fuite qui reste
// est physique — huit joueurs en cercle qui se voient les écrans. Cette fenêtre
// est la seule protection contre ce canal.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { SECRET } from '../src/styles/jetons.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');
const JETONS_CSS = readFileSync(resolve(SOURCE, 'styles', 'jetons.css'), 'utf8');
const VOILE = readFileSync(resolve(SOURCE, 'composants', 'VoileSecret.vue'), 'utf8');

/** Les deux jetons de géométrie de la fenêtre, tels que le compilateur les nomme. */
const JETON_LARGEUR = '--gdv-secret-largeur-fenetre';
const JETON_HAUTEUR = '--gdv-secret-hauteur-fenetre';

/** Écran de référence de la conception : 360 × 640 (principes_ergonomiques). */
const ECRAN_LARGEUR = 360;
const ECRAN_HAUTEUR = 640;

function fichiers(racine: string, extension: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiers(chemin, extension));
    else if (entree.name.endsWith(extension)) trouves.push(chemin);
  }
  return trouves;
}

const nom = (absolu: string): string => absolu.split(/[\\/]/u).pop() ?? absolu;
const COMPOSANTS = fichiers(SOURCE, '.vue');

/**
 * Bloc de style d'un fichier .vue, commentaires retirés. Les commentaires sont
 * nombreux et longs dans ce dépôt : les garder ferait entrer leur texte dans le
 * sélecteur capturé, et aucune règle ne serait jamais trouvée.
 */
function style(contenu: string): string {
  const ouverture = contenu.indexOf('<style');
  if (ouverture < 0) return '';
  // Après le « > » de la balise : sinon « <style scoped> » se retrouve collé au
  // premier sélecteur, et la première règle du fichier devient introuvable.
  return contenu.slice(contenu.indexOf('>', ouverture) + 1).replaceAll(/\/\*[\s\S]*?\*\//gu, '');
}

/** Corps d'une règle CSS, par sélecteur exact, dans un fichier .vue. */
function regle(contenu: string, selecteur: string): string | null {
  for (const trouve of style(contenu).matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    if ((trouve[1] ?? '').trim() === selecteur) return trouve[2] ?? '';
  }
  return null;
}

/** Longueur d'un jeton, lue dans le CSS compilé. */
function pixelsDuJeton(nomJeton: string, profondeur: number): number | null {
  const trouve = new RegExp(`${nomJeton}:\\s*([^;]+);`, 'u').exec(JETONS_CSS);
  return trouve === null ? null : enPixels(trouve[1] ?? '', profondeur + 1);
}

/** Un terme de calc() : « n * var(--jeton) », « var(--jeton) » ou « 12px ». */
function pixelsDuTerme(terme: string, profondeur: number): number | null {
  let produit = 1;
  let longueur: number | null = null;
  for (const facteur of terme.split('*').map((morceau) => morceau.trim())) {
    if (/^\d+$/u.test(facteur)) {
      produit *= Number(facteur);
      continue;
    }
    longueur = enPixels(facteur, profondeur + 1);
    if (longueur === null) return null;
  }
  return longueur === null ? null : produit * longueur;
}

/** Somme des termes d'un calc(). Additions seules : rien d'autre n'est écrit ici. */
function pixelsDuCalcul(expression: string, profondeur: number): number | null {
  let total = 0;
  for (const terme of expression.split('+')) {
    const mesure = pixelsDuTerme(terme, profondeur);
    if (mesure === null) return null;
    total += mesure;
  }
  return total;
}

/**
 * Résout une valeur de longueur CSS en pixels, en suivant les var() jusqu'à
 * jetons.css. Refuse tout ce qui n'est pas une longueur en pixels issue d'un
 * jeton ou d'un calc() de jetons : une valeur qu'on ne peut pas mesurer est un
 * échec, pas une tolérance.
 */
function enPixels(valeur: string, profondeur = 0): number | null {
  if (profondeur > 8) return null;
  const brut = valeur.trim();

  const direct = /^(\d+(?:\.\d+)?)px$/u.exec(brut);
  if (direct !== null) return Number(direct[1]);

  const variable = /^var\(\s*(--gdv-[a-z0-9-]+)\s*\)$/u.exec(brut);
  if (variable !== null) return pixelsDuJeton(variable[1] ?? '', profondeur);

  const calcul = /^calc\((.+)\)$/su.exec(brut);
  if (calcul !== null) return pixelsDuCalcul(calcul[1] ?? '', profondeur);

  return null;
}

function declaration(corps: string, propriete: string): string | null {
  const trouve = new RegExp(`(?<![a-z-])${propriete}:\\s*([^;]+);`, 'u').exec(corps);
  return trouve === null ? null : (trouve[1] ?? '').trim();
}

// =============================================================================
// (1) Les jetons existent et sortent bien en CSS
// =============================================================================

test('les deux jetons de géométrie sont ÉMIS en variables CSS', () => {
  // En TypeScript seul, ils ne peuvent pas peindre un pixel : une feuille de
  // style ne lit pas jetons.ts.
  for (const jeton of [JETON_LARGEUR, JETON_HAUTEUR]) {
    assert.match(
      JETONS_CSS,
      new RegExp(`${jeton}:\\s*\\d+px;`, 'u'),
      `${jeton} absent du CSS compilé : aucune règle ne pourrait s’y référer`,
    );
  }
  // Et leur valeur CSS est bien celle du contrat, via jetons.ts.
  assert.equal(enPixels(`var(${JETON_LARGEUR})`), Number.parseInt(String(SECRET['largeur-fenetre-lecture']), 10));
  assert.equal(enPixels(`var(${JETON_HAUTEUR})`), Number.parseInt(String(SECRET['hauteur-fenetre-lecture']), 10));
});

// =============================================================================
// (2) Les jetons sont CONSOMMÉS par un composant réel
// =============================================================================

test('les deux jetons sont consommés par au moins un composant', () => {
  const consommateurs = COMPOSANTS.filter((absolu) => {
    const contenu = readFileSync(absolu, 'utf8');
    return contenu.includes(JETON_LARGEUR) || contenu.includes(JETON_HAUTEUR);
  }).map(nom);

  assert.ok(
    consommateurs.length > 0,
    'les deux jetons de la fenêtre de lecture ne sont consommés par AUCUN composant : ' +
      'la protection du secret contre le regard du voisin n’existe alors pas dans le code',
  );
  assert.ok(
    consommateurs.includes('VoileSecret.vue'),
    `le composant central du dispositif doit les consommer (trouvés : ${consommateurs.join(', ')})`,
  );
});

// =============================================================================
// (3) L'enveloppe est BORNÉE — c'est ici que l'ancien test ne regardait rien
// =============================================================================

test('la fenêtre est bornée sur les DEUX axes, par les jetons et non en dur', () => {
  const corps = regle(VOILE, '.voile__fenetre');
  assert.ok(corps !== null, 'la règle .voile__fenetre est introuvable');

  const bornes: Record<string, readonly string[]> = {
    largeur: ['max-inline-size', 'inline-size', 'width', 'max-width'],
    hauteur: ['max-block-size', 'block-size', 'height', 'max-height'],
  };

  for (const [axe, proprietes] of Object.entries(bornes)) {
    const bornantes = proprietes.filter((propriete) => declaration(corps, propriete) !== null);
    assert.ok(
      bornantes.length > 0,
      `aucune borne de ${axe} sur la fenêtre de lecture : la surface exposée est libre`,
    );
    // min-* seul ne borne RIEN : il autorise la croissance. C'était le défaut.
    assert.ok(
      bornantes.some((propriete) => propriete.startsWith('max-') || !propriete.startsWith('min-')),
      `${axe} : seule une borne MINIMALE est déclarée, le contenu peut croître sans limite`,
    );
  }

  // Un maximum explicite sur chaque axe : c'est lui qui empêche un libellé long
  // de dilater la fenêtre. Sans lui, une clause de 100 caractères transforme
  // 96 × 64 en 96 × 200 sans qu'une seule ligne de code ne s'en aperçoive.
  for (const [propriete, jeton] of [
    ['max-inline-size', JETON_LARGEUR],
    ['max-block-size', JETON_HAUTEUR],
  ] as const) {
    const valeur = declaration(corps, propriete);
    assert.ok(valeur !== null, `${propriete} manquant sur .voile__fenetre`);
    assert.ok(
      valeur.includes(jeton),
      `${propriete} doit dériver de ${jeton}, et vaut « ${String(valeur)} » : ` +
        'une valeur en dur ne suivrait pas un réglage de playtest',
    );
  }
});

test('le contenu est CONFINÉ : un débordement ne dilate pas la fenêtre', () => {
  const corps = regle(VOILE, '.voile__fenetre') ?? '';
  const confinement =
    declaration(corps, 'overflow') ??
    declaration(corps, 'overflow-y') ??
    declaration(corps, 'overflow-block');
  assert.ok(
    confinement !== null,
    'sans overflow déclaré, un contenu plus grand que la fenêtre la déborde VISIBLEMENT : ' +
      'l’enveloppe mesurée ne serait pas celle que le voisin voit',
  );
  assert.ok(
    /auto|scroll|hidden|clip/u.test(confinement),
    `overflow « ${confinement} » ne confine rien`,
  );
  // Le défilement interne ne doit pas devenir un défilement de page : le
  // défilement de page remasque (M3), et le joueur perdrait sa lecture.
  assert.match(
    corps,
    /overscroll-behavior[^:]*:\s*contain/u,
    'overscroll-behavior: contain exigé — sinon le défilement interne se propage à la page ' +
      'et déclenche le remasquage de M3 au milieu de la lecture',
  );
});

// =============================================================================
// (4) La surface exposée, recalculée depuis le CSS RÉEL
// =============================================================================

/** Surface maximale réellement atteignable pour une règle de fenêtre donnée. */
function surface(selecteur: string, heriteDe: string | null): number | null {
  const corps = regle(VOILE, selecteur);
  if (corps === null) return null;
  const base = heriteDe === null ? '' : (regle(VOILE, heriteDe) ?? '');
  const lire = (propriete: string): string | null =>
    declaration(corps, propriete) ?? declaration(base, propriete);

  const largeur = enPixels(lire('max-inline-size') ?? lire('inline-size') ?? '');
  const hauteur = enPixels(lire('max-block-size') ?? lire('block-size') ?? '');
  if (largeur === null || hauteur === null) return null;
  return largeur * hauteur;
}

test('la surface lisible tient sous le plafond, CALCULÉE depuis le CSS écrit', () => {
  const plafond = Number(SECRET['surface-lisible-max-ratio']) * ECRAN_LARGEUR * ECRAN_HAUTEUR;

  // La fenêtre nominale, celle de la lecture et de la saisie.
  const nominale = surface('.voile__fenetre', null);
  assert.ok(
    nominale !== null,
    'la géométrie de .voile__fenetre n’est pas mesurable : ou une borne manque, ou une ' +
      'valeur ne dérive d’aucun jeton',
  );
  assert.ok(
    nominale <= plafond,
    `fenêtre nominale : ${String(nominale)} px² pour un plafond de ${String(plafond)} px²`,
  );

  // Toute variante qui redéfinit la géométrie est mesurée elle aussi. Une
  // variante non bornée serait une porte dérobée dans le dispositif.
  const variantes = [
    ...new Set(
      [...style(VOILE).matchAll(/(\.voile--[a-z_]+\s+\.voile__fenetre)\s*\{/gu)].map(
        (trouve) => trouve[1] as string,
      ),
    ),
  ];
  for (const selecteur of variantes) {
    const mesuree = surface(selecteur, '.voile__fenetre');
    assert.ok(mesuree !== null, `${selecteur} redéfinit la fenêtre sans géométrie mesurable`);
    assert.ok(
      mesuree <= plafond,
      `${selecteur} : ${String(mesuree)} px² pour un plafond de ${String(plafond)} px²`,
    );
  }
});

// =============================================================================
// (5) Les 8 catégories de données secrètes passent toutes par le composant
// =============================================================================

/**
 * Les 11 écrans qui affichent une donnée de regles_antifuite_visuelle
 * .donnees_concernees, et la catégorie que chacun porte.
 */
const ECRANS_SECRETS: readonly (readonly [string, string])[] = [
  ['EcranAttributionPrivee.vue', 'role_secret + mission_secrete'],
  ['EcranPliGenie.vue', 'clause reçue'],
  ['EcranAnnonceVoeu.vue', 'montant du vœu annoncé en privé'],
  ['EcranPaiementSecret.vue', 'montant_paye en cours de saisie'],
  ['EcranTransfert.vue', 'montant transféré'],
  ['EcranPropositionPret.vue', 'montant prêté'],
  ['EcranReponsePret.vue', 'conditions du prêt reçu'],
  ['EcranEnquetesAccusations.vue', 'existence même de l’enquête'],
  ['EcranResultatEnquete.vue', 'résultat d’enquête'],
  ['EcranDvProposition.vue', 'proposition privée du Dernier Vœu'],
  ['EcranDvSignature.vue', 'choix de signature du Dernier Vœu'],
];

test('les 11 écrans porteurs d’un secret passent TOUS par VoileSecret', () => {
  const manquants: string[] = [];
  for (const [fichier, categorie] of ECRANS_SECRETS) {
    const contenu = readFileSync(resolve(SOURCE, 'vues', fichier), 'utf8');
    if (!contenu.includes('VoileSecret')) manquants.push(`${fichier} (${categorie})`);
  }
  assert.deepEqual(manquants, [], `secrets hors dispositif : ${manquants.join(' | ')}`);
});

test('aucun écran ne rend une valeur secrète en dehors d’une lucarne', () => {
  // Tout secret est rendu dans un créneau #secret ou #saisie de VoileSecret.
  // Un secret rendu ailleurs dans le gabarit serait visible sans geste.
  const fautifs: string[] = [];
  for (const [fichier] of ECRANS_SECRETS) {
    const contenu = readFileSync(resolve(SOURCE, 'vues', fichier), 'utf8');
    const creneaux = [...contenu.matchAll(/<template\s+#(secret|saisie)>/gu)];
    if (creneaux.length === 0) fautifs.push(fichier);
  }
  assert.deepEqual(fautifs, [], `écrans sans créneau de secret : ${fautifs.join(' | ')}`);
});

test('la lucarne est poussée au BAS de la carte, du côté dominant', () => {
  const corps = regle(VOILE, '.voile__fenetre') ?? '';
  // « ancrage : tiers inferieur, cote secret.cote_dominant_par_defaut ».
  // Dans une carte en colonne, « pousser au bas » se dit margin-block-start:auto ;
  // le côté dominant se dit align-self, et s'inverse pour les gauchers.
  assert.match(
    corps,
    /margin-block-start:\s*auto/u,
    'la fenêtre doit être poussée au bas de la carte : c’est là que la main qui tient ' +
      'l’appareil fait écran au voisin',
  );
  assert.match(corps, /align-self:\s*flex-end/u, 'côté dominant par défaut : droite');
  assert.match(
    VOILE,
    /\[data-cote-dominant='gauche'\]\)?\s*\.voile__fenetre/u,
    'le côté doit être inversable pour les gauchers',
  );
});

// =============================================================================
// (6) Lisibilité : on réduit l'empreinte, JAMAIS la lisibilité
// =============================================================================

/** Classes citées dans les créneaux #secret et #saisie d'un écran. */
function classesDuSecret(contenu: string): ReadonlySet<string> {
  const creneaux = [
    ...contenu.matchAll(/<template\s+#(?:secret|saisie)>([\s\S]*?)<\/template>/gu),
  ].map((trouve) => trouve[1] ?? '');
  const attributs = creneaux.flatMap((creneau) => [...creneau.matchAll(/class="([^"{]+)"/gu)]);
  const noms = attributs.flatMap((trouve) => (trouve[1] ?? '').split(/\s+/u));
  return new Set(noms.filter((classe) => classe !== ''));
}

/** Rôles typographiques sous le plancher de lecture mobile de 16 px. */
const SOUS_LE_PLANCHER = ['--gdv-role-meta', '--gdv-role-etiquette'];

/** Classes d'un écran dont la taille de police descend sous le plancher. */
function tropPetites(contenu: string): readonly string[] {
  const trouvees: string[] = [];
  for (const classe of classesDuSecret(contenu)) {
    const corps = regle(contenu, `.${classe}`);
    const taille = corps === null ? '' : (declaration(corps, 'font-size') ?? '');
    const fautive = SOUS_LE_PLANCHER.some((interdit) => taille.includes(interdit));
    if (fautive) trouvees.push(`.${classe} : ${taille}`);
  }
  return trouvees;
}

test('aucun texte de lecture du secret ne descend sous taille.16', () => {
  // M4 est explicite : « on réduit l'empreinte physique et l'angle utile, pas la
  // lisibilité ». Et typographie.role._regle_mobile interdit tout texte de
  // lecture sous 16 px. Rétrécir la police pour faire entrer une clause dans la
  // fenêtre contourne la mesure au lieu de l'appliquer.
  const fautifs: string[] = [];
  for (const [fichier] of ECRANS_SECRETS) {
    const contenu = readFileSync(resolve(SOURCE, 'vues', fichier), 'utf8');
    for (const fautive of tropPetites(contenu)) fautifs.push(`${fichier} → ${fautive}`);
  }

  assert.deepEqual(
    fautifs,
    [],
    `texte de secret sous 16 px : ${fautifs.join(' | ')} — réduire la police pour ` +
      'faire entrer le contenu dégrade la lisibilité au lieu de réduire l’empreinte',
  );
});
