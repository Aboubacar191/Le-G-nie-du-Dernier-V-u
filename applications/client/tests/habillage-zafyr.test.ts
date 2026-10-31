// PREUVE — le thème Zafyr est APPLIQUÉ, et ses deux règles non négociables
// tiennent dans le code et pas seulement dans le contrat.
//
// DESIGN-GDV-001.json v1.1.0 n'a changé que des VALEURS : « npm run jetons »
// suffit à les propager, et jetons-generes.test.ts le vérifie à l'octet. Ce
// fichier-ci mesure ce qu'une recompilation ne peut pas garantir — l'USAGE :
//
//   1. couleur._regle_or_jamais_en_texte_courant — l'or n'est admis que sur les
//      rôles d'affichage (>= 20 px), les bordures, les pastilles pleines et les
//      tracés d'icône. Il est INTERDIT en couleur de texte sur corps, étiquette,
//      méta et sur TOUS les rôles numériques. La règle tient sur Von Restorff,
//      pas sur le contraste : étaler l'unique accent de la palette sur du texte
//      courant détruit la singularité de l'action principale.
//   2. typographie.famille._regle_chiffres_jamais_en_serif — famille.chiffres
//      reste la pile système tabulaire. Les chiffres sortent du chemin de
//      chargement des polices embarquées : un décalage de police sur un minuteur
//      est inacceptable.
//   3. iconographie.badge_lampe — le badge est PROSCRIT des 30 écrans de jeu.
//      À 360 px de large, le budget vertical appartient aux chiffres.
//   4. polices._obligation_juridique — l'OFL 1.1 EXIGE que la notice et la
//      licence accompagnent les woff2 redistribués. Un livrable sans
//      POLICES-LICENCES.txt est en infraction, pas en retard.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAQUET = resolve(ICI, '..');
const SOURCE = resolve(PAQUET, 'src');
const RACINE = resolve(PAQUET, '..', '..');
const DESIGN = resolve(RACINE, '.claude', 'orchestration', 'contrats', 'DESIGN-GDV-001.json');

interface Contrat {
  readonly tokens: {
    readonly typographie: { readonly famille: Record<string, string> };
    readonly couleur: { readonly theme_sombre: Record<string, string> };
  };
  readonly polices: {
    readonly familles: readonly { readonly nom: string; readonly copyright: string }[];
  };
}

const contrat = JSON.parse(readFileSync(DESIGN, 'utf8')) as Contrat;

function fichiers(racine: string, extensions: readonly string[]): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiers(chemin, extensions));
    else if (extensions.some((extension) => entree.name.endsWith(extension))) trouves.push(chemin);
  }
  return trouves;
}

const COMPOSANTS = fichiers(SOURCE, ['.vue']);
const nom = (absolu: string): string => absolu.split(/[\\/]/u).pop() ?? absolu;

// --- Règle 1 : l'or n'est jamais une couleur de texte courant ----------------

/** Les quatre jetons de la famille d'or, plus leurs états. */
const OR = [
  'accent-action',
  'accent-action-survol',
  'accent-action-actif',
  'accent-focus',
  'bordure-secret',
  'marque-prive',
] as const;

/** Rôles sur lesquels l'or est admis : >= 20 px, affichage seul. */
const ROLES_AUTORISES = ['titre-ecran', 'titre-section', 'voix-genie'] as const;

/** Déclarations de style d'un fichier .vue, par sélecteur. */
function blocs(contenu: string): readonly { readonly selecteur: string; readonly corps: string }[] {
  const style = contenu.slice(contenu.indexOf('<style'));
  return [...style.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((trouve) => ({
    selecteur: (trouve[1] ?? '').trim(),
    corps: trouve[2] ?? '',
  }));
}

test('l’or n’est JAMAIS la couleur d’un texte courant ni d’un nombre', () => {
  const motifOr = new RegExp(`(?<![a-z-])color:\\s*var\\(--gdv-(${OR.join('|')})\\)`, 'u');
  const fautifs: string[] = [];

  for (const absolu of COMPOSANTS) {
    for (const bloc of blocs(readFileSync(absolu, 'utf8'))) {
      if (!motifOr.test(bloc.corps)) continue;
      // Un TRACÉ D'ICÔNE est explicitement admis : la couleur n'y porte pas du
      // texte, elle alimente currentColor d'un stroke ou d'un fill SVG. Le
      // marqueur est objectif — le bloc déclare stroke-width ou fill.
      if (/\b(stroke-width|fill)\s*:/u.test(bloc.corps)) continue;
      const role = /font-size:\s*var\(--gdv-role-([a-z-]+)\)/u.exec(bloc.corps)?.[1];
      // Sans font-size déclaré, le bloc hérite du rôle corps : interdit.
      const admis = role !== undefined && (ROLES_AUTORISES as readonly string[]).includes(role);
      if (!admis) fautifs.push(`${nom(absolu)} → ${bloc.selecteur} (rôle ${role ?? 'hérité = corps'})`);
    }
  }

  assert.deepEqual(
    fautifs,
    [],
    'l’or est admis sur titre-ecran, titre-section et voix-genie, sur les bordures, ' +
      'les pastilles PLEINES et les tracés d’icône — jamais en couleur de texte ' +
      `ailleurs : ${fautifs.join(' | ')}`,
  );
});

test('aucun rôle numérique ne reçoit l’or, même au-delà de 20 px', () => {
  const motifOr = new RegExp(`(?<![a-z-])color:\\s*var\\(--gdv-(${OR.join('|')})\\)`, 'u');
  const fautifs: string[] = [];

  for (const absolu of COMPOSANTS) {
    for (const bloc of blocs(readFileSync(absolu, 'utf8'))) {
      const numerique = /font-size:\s*var\(--gdv-role-(nombre-principal|nombre-secondaire|minuteur)\)/u.test(
        bloc.corps,
      );
      if (numerique && motifOr.test(bloc.corps)) fautifs.push(`${nom(absolu)} → ${bloc.selecteur}`);
    }
  }

  assert.deepEqual(fautifs, [], `or sur un rôle numérique : ${fautifs.join(' | ')}`);
});

// --- Règle 2 : les chiffres restent sur la pile système ----------------------

test('famille.chiffres est la pile système, ni Cinzel ni DM Sans', () => {
  const chiffres = contrat.tokens.typographie.famille.chiffres ?? '';
  assert.ok(chiffres.includes('ui-monospace'), 'famille.chiffres doit partir de ui-monospace');
  for (const embarquee of ['Cinzel', 'DM Sans']) {
    assert.ok(
      !chiffres.includes(embarquee),
      `famille.chiffres ne doit contenir aucune police embarquée (${embarquee} trouvée)`,
    );
  }
  // Et rien ne la fait pointer sur la famille de titre dans le CSS compilé.
  const jetons = readFileSync(resolve(SOURCE, 'styles', 'jetons.css'), 'utf8');
  const declaration = /--gdv-famille-chiffres:([^;]+);/u.exec(jetons)?.[1] ?? '';
  assert.ok(declaration.includes('ui-monospace'), 'le CSS compilé a perdu la pile système');
  assert.ok(!/Cinzel|DM Sans|var\(/u.test(declaration), 'famille-chiffres doit être autonome');
});

test('tout rôle numérique est composé en famille.chiffres et en largeur tabulaire', () => {
  const fautifs: string[] = [];
  for (const absolu of COMPOSANTS) {
    for (const bloc of blocs(readFileSync(absolu, 'utf8'))) {
      if (
        !/font-size:\s*var\(--gdv-role-(nombre-principal|nombre-secondaire|minuteur)\)/u.test(
          bloc.corps,
        )
      ) {
        continue;
      }
      if (!/font-family:\s*var\(--gdv-famille-chiffres\)/u.test(bloc.corps)) {
        fautifs.push(`${nom(absolu)} → ${bloc.selecteur} : famille.chiffres absente`);
      }
      if (!/font-variant-numeric:\s*var\(--gdv-chiffres-variant\)/u.test(bloc.corps)) {
        fautifs.push(`${nom(absolu)} → ${bloc.selecteur} : tabular-nums absent`);
      }
    }
  }
  assert.deepEqual(fautifs, [], `rôles numériques non conformes : ${fautifs.join(' | ')}`);
});

test('aucun chiffre ne dépend d’un fichier de police embarqué', () => {
  // famille.chiffres ne déclare AUCUN @font-face : par construction, les chiffres
  // sont déjà présents sur l'appareil et ne peuvent pas se décaler au chargement.
  const global = readFileSync(resolve(SOURCE, 'styles', 'global.css'), 'utf8');
  const familles = [...global.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'/gu)].map(
    (trouve) => trouve[1],
  );
  assert.deepEqual([...new Set(familles)].sort(), ['Cinzel', 'DM Sans']);
});

test('@font-face est déclaré UNE SEULE FOIS, et jamais dans un composant', () => {
  const fautifs = COMPOSANTS.filter((absolu) => readFileSync(absolu, 'utf8').includes('@font-face'));
  assert.deepEqual(fautifs.map(nom), [], 'variables_css.regle_polices : @font-face hors feuille globale');

  const global = readFileSync(resolve(SOURCE, 'styles', 'global.css'), 'utf8');
  const blocsPolice = [...global.matchAll(/@font-face\s*\{[^}]*\}/gu)].map((trouve) => trouve[0]);
  assert.equal(blocsPolice.length, 10, 'Cinzel 600/700 et DM Sans 400/500/700, en latin et latin-ext');
  for (const bloc of blocsPolice) {
    assert.match(bloc, /font-display:\s*swap/u, 'font-display: swap exigé sur les deux familles');
    assert.match(bloc, /unicode-range:/u, 'découpage par unicode-range exigé');
  }
  // latin-ext est OBLIGATOIRE : les pseudonymes attendus portent des accents
  // hors Latin-1. U+0100-02BA en est la borne basse chez Google Fonts.
  assert.equal(
    blocsPolice.filter((bloc) => bloc.includes('U+0100-02BA')).length,
    5,
    'un sous-ensemble latin-ext par déclaration de graisse',
  );
});

// --- Règle 3 : le badge ne quitte pas l'écran de lancement -------------------

test('le badge à la lampe n’apparaît QUE sur ECR-01', () => {
  const porteurs = COMPOSANTS.filter(
    (absolu) =>
      nom(absolu) !== 'BadgeLampe.vue' && readFileSync(absolu, 'utf8').includes('BadgeLampe'),
  ).map(nom);
  assert.deepEqual(
    porteurs,
    ['EcranAccueil.vue'],
    'iconographie.interdits : aucun glyphe de lampe sur un écran de jeu — la marque ' +
      'ne concurrence pas les chiffres',
  );
});

test('le badge porte le NOM DU JEU, et se taît quand un h1 le répète', () => {
  const badge = readFileSync(resolve(SOURCE, 'composants', 'BadgeLampe.vue'), 'utf8');
  // Le texte alternatif vient du fichier de contenu (RG-61), jamais du composant.
  assert.match(badge, /texte\('commun\.titre_application'\)/u);
  // Un aria-label NON lié (sans « : ») serait du français écrit dans le
  // composant, ce que RG-61 interdit : tout le français vit dans contenu/*.json.
  assert.ok(!/(?<![:\w-])aria-label="/u.test(badge), 'aucun libellé en dur dans le composant');
  assert.match(badge, /aria-hidden/u, 'le badge doit pouvoir se retirer de l’arbre accessible');

  // Les trois pastilles sont décoratives : un lecteur d'écran qui les annonce
  // annonce une progression qui n'existe pas.
  const pastilles = /class="badge__pastilles"[\s\S]{0,80}aria-hidden="true"/u.test(badge);
  assert.ok(pastilles, 'les pastilles de progression doivent être aria-hidden');

  // L'écran de lancement porte un h1 : le badge y est donc décoratif.
  const accueil = readFileSync(resolve(SOURCE, 'vues', 'EcranAccueil.vue'), 'utf8');
  assert.match(accueil, /<BadgeLampe\s+:titre-adjacent="true"/u);
  assert.match(accueil, /<h1/u, 'le h1 doit répéter le nom du jeu en texte réel');
});

// --- Règle 4 : la licence accompagne les fichiers ---------------------------

const POLICES = resolve(PAQUET, 'public', 'polices');

test('les quatre fichiers woff2 sont embarqués et pèsent moins que le plafond', () => {
  const attendus = [
    'cinzel-latin.woff2',
    'cinzel-latin-ext.woff2',
    'dm-sans-latin.woff2',
    'dm-sans-latin-ext.woff2',
  ];
  let total = 0;
  for (const fichier of attendus) {
    const taille = statSync(join(POLICES, fichier)).size;
    assert.ok(taille > 0, `${fichier} est vide`);
    total += taille;
  }
  // Plafond annoncé au contrat : « environ 125 ko » pour les polices. Mesure
  // réelle : 93,4 ko, parce que les deux familles sont VARIABLES et qu'un seul
  // fichier par sous-ensemble sert toutes les graisses. Le repli « abandonner
  // DM Sans » n'a donc pas à être appliqué.
  assert.ok(total <= 125 * 1024, `polices : ${String(total)} octets pour un plafond de 128000`);
});

test('POLICES-LICENCES.txt accompagne les woff2, avec les deux notices du contrat', () => {
  const licence = readFileSync(join(POLICES, 'POLICES-LICENCES.txt'), 'utf8');
  for (const famille of contrat.polices.familles) {
    assert.ok(
      licence.includes(famille.copyright),
      `notice de copyright de ${famille.nom} absente — l’OFL 1.1 l’EXIGE`,
    );
  }
  assert.ok(
    licence.includes('SIL OPEN FONT LICENSE Version 1.1'),
    'le texte intégral de la licence doit accompagner les fichiers',
  );
  // Noms réservés : l'OFL interdit leur reprise par une version modifiée.
  assert.match(licence, /noms? réservés?/iu);
});

// --- Thème : la feuille d'appoint littérale a bien disparu ------------------

test('aucune feuille de style ne surcharge les jetons compilés', () => {
  const styles = fichiers(resolve(SOURCE, 'styles'), ['.css']).map(nom).sort();
  assert.deepEqual(
    styles,
    ['global.css', 'jetons.css'],
    'un styles/theme-prototype.css écrit à la main redéfinissait les 29 jetons de ' +
      'couleur en hexadécimal APRÈS jetons.css : la valeur affichée ne venait plus ' +
      'du contrat. Toute feuille d’appoint de ce type est désormais interdite.',
  );

  const global = readFileSync(resolve(SOURCE, 'styles', 'global.css'), 'utf8');
  for (const jeton of Object.keys(contrat.tokens.couleur.theme_sombre)) {
    if (jeton.startsWith('_')) continue;
    assert.ok(
      !new RegExp(`--gdv-${jeton}\\s*:`, 'u').test(global),
      `global.css redéfinit --gdv-${jeton} : seul le compilateur pose les valeurs`,
    );
  }
});

test('le thème tranché a remplacé les gris neutres de l’attente d’ESC-01', () => {
  const sombre = contrat.tokens.couleur.theme_sombre['surface-fond'] ?? '';
  const indexHtml = readFileSync(resolve(PAQUET, 'index.html'), 'utf8');
  assert.ok(
    indexHtml.includes(sombre),
    'la couleur d’interface du navigateur doit suivre tokens.couleur.theme_sombre.surface-fond',
  );
});
