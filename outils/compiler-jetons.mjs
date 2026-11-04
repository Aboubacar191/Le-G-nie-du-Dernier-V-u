#!/usr/bin/env node
// =============================================================================
// COMPILATEUR DE JETONS — DESIGN-GDV-001.json → variables CSS + constantes TS
// =============================================================================
// Les variables de style ne sont pas RÉDIGÉES : elles sont GÉNÉRÉES depuis le
// contrat de conception. Deux exécutions sur le même contrat produisent des
// fichiers identiques à l'octet.
//
// Convention imposée par DESIGN-GDV-001.json / variables_css : préfixe « gdv »,
// kebab-case, intention conservée à l'identique du jeton JSON, bascule de thème
// par attribut data-theme sur la racine.
//
// Pourquoi un générateur local plutôt que l'outil d'équipe compiler-tokens.mjs :
// l'arbre de jetons porte DEUX jeux de valeurs pour les mêmes 30 noms de
// couleur (couleur.theme_clair et couleur.theme_sombre) et des valeurs qui
// RÉFÉRENCENT d'autres jetons (« inset 0 0 0 trait.moyen couleur.bordure-secret »).
// Un aplatissement générique produirait --gdv-couleur-theme-clair-surface-fond
// et laisserait les références non résolues — c'est-à-dire des valeurs CSS
// invalides. Le nommage ci-dessous est celui que le contrat prescrit, et les
// références sont résolues en var().
//
// Les points de rupture ne sont PAS émis en CSS : une variable CSS ne fonctionne
// pas dans une règle @media (contrainte de la spécification, pas un choix). Ils
// sortent en constantes TypeScript.
//
// Usage  : node outils/compiler-jetons.mjs [--verifier]
//          --verifier : n'écrit rien, échoue si les fichiers générés diffèrent.
// Sortie : 0 = jetons compilés (ou conformes), 1 = échec
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN_DESIGN = join(RACINE, '.claude', 'orchestration', 'contrats', 'DESIGN-GDV-001.json');
const DOSSIER_SORTIE = join(RACINE, 'applications', 'client', 'src', 'styles');
const SORTIE_CSS = join(DOSSIER_SORTIE, 'jetons.css');
const SORTIE_TS = join(DOSSIER_SORTIE, 'jetons.ts');

const verifierSeulement = process.argv.includes('--verifier');

const EN_TETE = [
  'GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.',
  '',
  'Source      : .claude/orchestration/contrats/DESIGN-GDV-001.json (section tokens)',
  'Générateur  : outils/compiler-jetons.mjs',
  'Régénérer   : npm run jetons',
  '',
  'Toute correction se fait dans le contrat de conception, jamais ici : une',
  'valeur retouchée à la main disparaît à la prochaine compilation, et la',
  'divergence entre le contrat et l’écran passe inaperçue.',
];

// --- Nommage : chemin de jeton → nom de variable CSS -------------------------
// Prescrit par DESIGN-GDV-001.json / variables_css.exemples_couleur et
// exemples_dimension. Les groupes « couleur » et « typographie » sont ÉLIDÉS
// (couleur.surface-fond → --gdv-surface-fond, typographie.taille.16 →
// --gdv-taille-16) ; les autres groupes sont conservés.
const kebab = (texte) => texte.replaceAll('_', '-').replaceAll('.', '-');

const RENOMMAGES_EXPLICITES = new Map([
  ['secret.largeur_fenetre_lecture', 'secret-largeur-fenetre'],
  ['secret.hauteur_fenetre_lecture', 'secret-hauteur-fenetre'],
  ['composant.hauteur', 'hauteur'],
  ['composant.largeur', 'largeur'],
  ['composant.gouttiere_ecran', 'gouttiere-ecran'],
  ['composant.gouttiere_ecran_large', 'gouttiere-ecran-large'],
]);

/** Jetons qui ne sont pas des valeurs CSS : ils sortent en TypeScript seul. */
const HORS_CSS = new Set([
  'secret.ancrage_vertical',
  'secret.cote_dominant_par_defaut',
  'secret.surface_lisible_max_ratio',
]);

/** Groupes entiers absents du CSS. rupture : interdit en @media (spécification CSS). */
const GROUPES_HORS_CSS = new Set(['rupture']);

function nomVariable(chemin) {
  for (const [prefixe, remplacement] of RENOMMAGES_EXPLICITES) {
    if (chemin === prefixe) return `--gdv-${remplacement}`;
    if (chemin.startsWith(`${prefixe}.`)) {
      return `--gdv-${remplacement}-${kebab(chemin.slice(prefixe.length + 1))}`;
    }
  }
  if (chemin.startsWith('couleur.theme_clair.')) return `--gdv-${chemin.slice(20)}`;
  if (chemin.startsWith('couleur.theme_sombre.')) return `--gdv-${chemin.slice(21)}`;
  if (chemin.startsWith('couleur.')) return `--gdv-${chemin.slice(8)}`;
  if (chemin.startsWith('typographie.')) return `--gdv-${kebab(chemin.slice(12))}`;
  return `--gdv-${kebab(chemin)}`;
}

// --- Lecture du contrat -------------------------------------------------------
let jetons;
try {
  jetons = JSON.parse(readFileSync(CHEMIN_DESIGN, 'utf8')).tokens;
} catch (erreur) {
  console.error(`ÉCHEC — DESIGN-GDV-001.json illisible : ${erreur.message}`);
  process.exit(1);
}
if (!jetons || typeof jetons !== 'object') {
  console.error('ÉCHEC — DESIGN-GDV-001.json : section « tokens » absente.');
  process.exit(1);
}

/** Aplatit l'arbre en [chemin, valeur], en ignorant toute clé commençant par « _ ». */
function aplatir(noeud, prefixe = '') {
  const paires = [];
  for (const [cle, valeur] of Object.entries(noeud)) {
    if (cle.startsWith('_')) continue;
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur)) {
      paires.push(...aplatir(valeur, chemin));
    } else {
      paires.push([chemin, valeur]);
    }
  }
  return paires;
}

const toutesLesPaires = aplatir(jetons);

// --- Résolution des références inter-jetons -----------------------------------
// Une valeur peut citer d'autres jetons par leur chemin. Les chemins les plus
// longs sont substitués d'abord, sinon « couleur.ombre-teinte » serait entamé
// par un préfixe plus court.
const CHEMINS_REFERENCABLES = toutesLesPaires
  .map(([chemin]) => chemin)
  .concat(Object.keys(jetons.couleur.theme_clair).map((cle) => `couleur.${cle}`))
  .filter((chemin) => !chemin.startsWith('couleur.theme_'))
  .sort((a, b) => b.length - a.length);

function resoudre(valeur) {
  if (typeof valeur !== 'string') return String(valeur);
  let resultat = valeur;
  for (const chemin of CHEMINS_REFERENCABLES) {
    if (!resultat.includes(chemin)) continue;
    resultat = resultat.replaceAll(chemin, `var(${nomVariable(chemin)})`);
  }
  return resultat;
}

// --- Génération du CSS --------------------------------------------------------
const commentaireCss = `/*\n${EN_TETE.map((l) => ` * ${l}`.trimEnd()).join('\n')}\n */\n`;

function declarationsCouleur(theme) {
  return Object.entries(jetons.couleur[theme])
    .filter(([cle]) => !cle.startsWith('_'))
    .map(([cle, valeur]) => `  --gdv-${cle}: ${valeur};`)
    .join('\n');
}

const pairesNonCouleur = toutesLesPaires.filter(
  ([chemin]) =>
    !chemin.startsWith('couleur.') &&
    !HORS_CSS.has(chemin) &&
    !GROUPES_HORS_CSS.has(chemin.split('.')[0]),
);

const declarationsDimension = pairesNonCouleur
  .map(([chemin, valeur]) => `  ${nomVariable(chemin)}: ${resoudre(valeur)};`)
  .join('\n');

const css = `${commentaireCss}
/* --- Thème clair : valeurs par défaut (variables_css.racine) --------------- */
:root,
[data-theme='clair'] {
${declarationsCouleur('theme_clair')}

  /* Dimensions, durées, courbes et seuils — indépendants du thème. */
${declarationsDimension}
}

/* --- Thème sombre, demandé explicitement (variables_css.racine_sombre) ---- */
[data-theme='sombre'] {
${declarationsCouleur('theme_sombre')}
}

/* --- Thème sombre, préférence système, avant tout réglage local ------------ */
/* Les deux thèmes sont des livrables ÉGAUX : le jeu se joue en soirée comme en
   plein jour. Ce bloc ne s'applique qu'en l'absence d'attribut data-theme, pour
   que la couleur soit juste dès le premier rendu, sans attendre le script. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${Object.entries(jetons.couleur.theme_sombre)
  .filter(([cle]) => !cle.startsWith('_'))
  .map(([cle, valeur]) => `    --gdv-${cle}: ${valeur};`)
  .join('\n')}
  }
}

/* --- Mouvement réduit (variables_css.regle_mouvement_reduit) --------------- */
/* Les durées de CONFIDENTIALITÉ (remasquage, révélation, maintien) ne sont pas
   redéfinies ici : ce sont des règles de secret, pas des animations. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --gdv-duree-rapide: ${jetons.duree.instantanee};
    --gdv-duree-normale: ${jetons.duree.instantanee};
    --gdv-duree-lente: ${jetons.duree.instantanee};
  }
}
`;

// --- Génération du TypeScript -------------------------------------------------
const litteral = (valeur) => (typeof valeur === 'number' ? String(valeur) : JSON.stringify(valeur));

function blocTs(nom, chemins, commentaire) {
  const entrees = chemins
    .map(([chemin, valeur]) => `  ${JSON.stringify(kebab(chemin.split('.').pop()))}: ${litteral(valeur)},`)
    .join('\n');
  return `/** ${commentaire} */\nexport const ${nom} = {\n${entrees}\n} as const;\n`;
}

const paires = (prefixe) =>
  toutesLesPaires.filter(([chemin]) => chemin.startsWith(`${prefixe}.`));

const ts = `${`//\n${EN_TETE.map((l) => `// ${l}`.trimEnd()).join('\n')}\n//`}

${blocTs(
  'RUPTURES',
  paires('rupture'),
  'Points de rupture. En constantes TypeScript et non en variables CSS : une ' +
    'variable CSS ne fonctionne pas dans une règle @media (spécification CSS).',
)}
${blocTs(
  'MINUTEUR',
  paires('minuteur'),
  'Seuils de bascule du minuteur. Le décompte est dérivé de phase_fin_at corrigé ' +
    'du décalage d’horloge (RG-72, RG-79) ; il n’est jamais la source de vérité.',
)}
${blocTs(
  'DUREES_MS',
  paires('duree').map(([chemin, valeur]) => [chemin, Number.parseInt(String(valeur), 10)]),
  'Durées en millisecondes. Les durées de confidentialité (remasquage, révélation, ' +
    'maintien) sont FONCTIONNELLES et ne sont pas réduites sous prefers-reduced-motion.',
)}
${blocTs(
  'SECRET',
  paires('secret'),
  'Paramètres du dispositif anti-regard-du-voisin (regles_antifuite_visuelle).',
)}
/** Thèmes livrés. Aucun n’est une option : le jeu se joue de jour comme de nuit. */
export const THEMES = ['clair', 'sombre'] as const;
export type Theme = (typeof THEMES)[number];

/** Noms des 30 jetons sémantiques de couleur, identiques dans les deux thèmes. */
export const JETONS_COULEUR = [
${Object.keys(jetons.couleur.theme_clair)
  .filter((cle) => !cle.startsWith('_'))
  .map((cle) => `  '${cle}',`)
  .join('\n')}
] as const;
`;

// --- Écriture ou vérification -------------------------------------------------
if (!existsSync(DOSSIER_SORTIE)) mkdirSync(DOSSIER_SORTIE, { recursive: true });

const attendus = [
  [SORTIE_CSS, css],
  [SORTIE_TS, ts],
];

if (verifierSeulement) {
  const divergents = attendus.filter(
    ([chemin, contenu]) => !existsSync(chemin) || readFileSync(chemin, 'utf8') !== contenu,
  );
  if (divergents.length > 0) {
    console.error(
      'ÉCHEC — jetons générés divergents de DESIGN-GDV-001.json :\n' +
        divergents.map(([chemin]) => `  · ${chemin}`).join('\n') +
        '\n        Relancer « npm run jetons ».',
    );
    process.exit(1);
  }
  console.log('JETONS CONFORMES — les fichiers générés correspondent au contrat.');
  process.exit(0);
}

for (const [chemin, contenu] of attendus) writeFileSync(chemin, contenu, 'utf8');

const nbCouleurs = Object.keys(jetons.couleur.theme_clair).filter((c) => !c.startsWith('_')).length;
console.log(
  `JETONS COMPILÉS — ${nbCouleurs} couleurs × 2 thèmes, ` +
    `${pairesNonCouleur.length} dimensions, durées et seuils.\n` +
    `  ${SORTIE_CSS}\n  ${SORTIE_TS}`,
);
