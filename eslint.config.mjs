// Configuration ESLint 9 — plate, unique, avec surcharges par paquet.
// Les seuils numériques ne sont PAS choisis ici : ils sont LUS dans
// ARCHI-GDV-001.json (seuils_qualite). Si le contrat est absent ou amputé,
// le lint échoue au chargement plutôt que de s'exécuter sur des seuils inventés.
//
// Référence : ARCHI-GDV-001.json / seuils_qualite.interdits_mecaniques.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

const racine = dirname(fileURLToPath(import.meta.url));
const CHEMIN_ARCHI = join(racine, '.claude', 'orchestration', 'contrats', 'ARCHI-GDV-001.json');

const archi = JSON.parse(readFileSync(CHEMIN_ARCHI, 'utf8'));
const seuils = archi.seuils_qualite;

function exige(cle) {
  const valeur = seuils?.[cle];
  if (typeof valeur !== 'number') {
    throw new Error(
      `ARCHI-GDV-001.json : seuils_qualite.${cle} absent ou non numérique. ` +
        `Le lint refuse de s'exécuter sur un seuil inventé.`,
    );
  }
  return valeur;
}

const COMPLEXITE_MAX = exige('complexite_cyclomatique_max');
const LONGUEUR_FONCTION_MAX = exige('longueur_fonction_max');
const PROFONDEUR_MAX = exige('profondeur_imbrication_max');
const TAILLE_FICHIER_MAX = exige('taille_fichier_max_lignes');

// --- Interdits mécaniques du paquet moteur ----------------------------------
// « Math.random, Date.now, new Date() sans argument, process, crypto sont interdits »
// Lecture appliquée : TOUTE forme de Date et de crypto est refusée dans le moteur
// (mission S3B : interdiction de Math.random, Date.now, new Date et crypto).
// L'aléa passe par src/alea/interface.ts, l'horloge par src/horloge/interface.ts.
const SYNTAXE_INTERDITE_MOTEUR = [
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message:
      'Math.random est interdit dans le moteur : l’aléa est injecté via Alea (ADR-TL-08). ' +
      'Sans cela aucun test n’est reproductible et le rejeu du journal ne reconstruit pas le même état.',
  },
  {
    selector: "MemberExpression[object.name='Date']",
    message:
      'Date.* est interdit dans le moteur : l’horloge est injectée via Horloge.maintenant() (RG-72).',
  },
  {
    selector: "NewExpression[callee.name='Date']",
    message:
      'new Date est interdit dans le moteur : l’horloge est injectée via Horloge.maintenant() (RG-72).',
  },
  {
    selector: "Identifier[name='crypto']",
    message:
      'crypto est interdit dans le moteur : la graine est fournie par la couche transport, ' +
      'le moteur ne tire jamais un nombre lui-même (ADR-TL-08).',
  },
  {
    selector: "Identifier[name='process']",
    message:
      'process est interdit dans le moteur : aucune E/S, aucune variable d’environnement ' +
      'dans la couche pure. La configuration arrive en paramètre (RG-60).',
  },
];

// --- Interdit mécanique de la couche temps réel du serveur ------------------
// RG-01 : le diffuseur n'expose que envoyerA(joueurId, evenement).
// Aucune fonction nommée diffuser / broadcast / emitAll / toAll ne peut être déclarée.
const NOMS_DIFFUSION = '^(diffuser|broadcast|emitAll|toAll|diffuserATous|sendAll)$';
const MESSAGE_DIFFUSION =
  'RG-01 : aucune primitive de diffusion ne peut être déclarée dans la couche temps réel. ' +
  'Le diffuseur n’expose que envoyerA(joueurId, evenement) ; un événement « public » est ' +
  'une boucle de projections individuelles (ADR-TL-03).';
const SYNTAXE_INTERDITE_TEMPS_REEL = [
  `FunctionDeclaration[id.name=/${NOMS_DIFFUSION}/]`,
  `VariableDeclarator[id.name=/${NOMS_DIFFUSION}/]`,
  `MethodDefinition[key.name=/${NOMS_DIFFUSION}/]`,
  `Property[key.name=/${NOMS_DIFFUSION}/]`,
  `TSMethodSignature[key.name=/${NOMS_DIFFUSION}/]`,
  `TSPropertySignature[key.name=/${NOMS_DIFFUSION}/]`,
  `ClassProperty[key.name=/${NOMS_DIFFUSION}/]`,
  `PropertyDefinition[key.name=/${NOMS_DIFFUSION}/]`,
].map((selector) => ({ selector, message: MESSAGE_DIFFUSION }));

export default tseslint.config(
  // --- Périmètre --------------------------------------------------------------
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      'rapports/**',
      '.claude/**',
      '.idea/**',
      '**/*.d.ts',
      '*.html',
    ],
  },

  // --- Socle commun -----------------------------------------------------------
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // --- Seuils de qualité, tous paquets (ARCHI seuils_qualite) -----------------
  {
    files: ['**/*.{ts,mts,cts,mjs,js,vue}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      complexity: ['error', COMPLEXITE_MAX],
      'max-lines-per-function': [
        'error',
        { max: LONGUEUR_FONCTION_MAX, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-depth': ['error', PROFONDEUR_MAX],
      'max-lines': [
        'error',
        { max: TAILLE_FICHIER_MAX, skipBlankLines: true, skipComments: true },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // --- PAQUET MOTEUR : couche pure, déterministe, sans E/S --------------------
  {
    files: ['paquets/moteur/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SYNTAXE_INTERDITE_MOTEUR],
      'no-restricted-globals': [
        'error',
        {
          name: 'crypto',
          message: 'crypto est interdit dans le moteur (ADR-TL-08) : la graine est injectée.',
        },
        {
          name: 'process',
          message: 'process est interdit dans le moteur : aucune E/S dans la couche pure.',
        },
        {
          name: 'Date',
          message: 'Date est interdit dans le moteur : utiliser Horloge.maintenant() (RG-72).',
        },
        {
          name: 'fetch',
          message: 'Aucune E/S dans le moteur : la couche pure ne parle à personne.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'path',
                'crypto',
                'http',
                'https',
                'net',
                'os',
                'ws',
                'fastify',
                'zod',
                'vue',
                '@gdv/serveur',
                '@gdv/client',
                '@gdv/moteur',
              ],
              message:
                'Le moteur ne peut importer que @gdv/partage : aucun module node:, aucune ' +
                'dépendance externe (ARCHI conventions.regles_de_couches). Une E/S qui ' +
                's’infiltre ici rend le moteur non testable sans serveur.',
            },
          ],
        },
      ],
      'no-magic-numbers': [
        'error',
        {
          ignore: [0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },

  // --- SERVEUR / temps réel : aucune primitive de diffusion -------------------
  {
    files: ['applications/serveur/src/temps-reel/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SYNTAXE_INTERDITE_TEMPS_REEL],
    },
  },

  // --- CLIENT : PWA Vue 3 -----------------------------------------------------
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['applications/client/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // Le jeton de session vit en localStorage : une XSS serait le seul vecteur
      // d'exfiltration (dette_assumee). v-html est donc interdit, sans exception.
      'vue/no-v-html': 'error',
    },
  },

  // --- Fichiers de configuration CommonJS (dependency-cruiser) ----------------
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.commonjs },
    },
  },

  // --- Outils de la chaîne de vérification (scripts Node) ---------------------
  {
    files: ['outils/**/*.mjs', '*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // --- Tests : les mesures de taille ne s'y appliquent pas de la même façon ---
  {
    files: ['**/tests/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
    },
  },
);
