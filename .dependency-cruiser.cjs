// Règles de couches — ARCHI-GDV-001.json / conventions.regles_de_couches.
// Une violation ferme la porte : `npm run verifier:couches` sort en code 1.
//
// Rappel du découpage : MOTEUR PUR (déterministe, sans E/S) strictement séparé
// de la COUCHE TRANSPORT. Le moteur se teste sans serveur, sans socket, sans base.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'moteur-couche-pure',
      comment:
        'Le moteur ne peut importer que @gdv/partage. Aucun module node:, aucune ' +
        'dépendance externe, ni le serveur, ni le client. Une E/S qui s’infiltre dans ' +
        'la couche pure rend le moteur non testable sans serveur et le rejeu non ' +
        'reproductible (ARCHI conventions.regles_de_couches).',
      severity: 'error',
      from: { path: '^paquets/moteur/src' },
      to: {
        pathNot: ['^paquets/moteur/src', '^paquets/partage/src'],
      },
    },
    {
      name: 'moteur-ignore-le-serveur',
      comment:
        'serveur ne peut PAS être importé par moteur (règle énoncée séparément dans ' +
        'l’ARCHI, maintenue explicite pour que le message d’erreur la nomme).',
      severity: 'error',
      from: { path: '^paquets/moteur' },
      to: { path: '^applications/serveur' },
    },
    {
      name: 'partage-ne-depend-que-de-zod',
      comment:
        'partage ne dépend de rien d’autre que de zod : c’est le seul paquet importable ' +
        'par tous les autres, sa surface de dépendance doit rester nulle.',
      severity: 'error',
      from: { path: '^paquets/partage/src' },
      to: {
        pathNot: ['^paquets/partage/src', '^node_modules/zod'],
      },
    },
    {
      name: 'client-sans-moteur-ni-serveur',
      comment:
        'client peut importer partage, jamais moteur ni serveur. Un client qui embarque ' +
        'le moteur embarque les règles de calcul des secrets (RG-01, priorité 1).',
      severity: 'error',
      from: { path: '^applications/client' },
      to: { path: '^(paquets/moteur|applications/serveur)' },
    },
    {
      name: 'transport-passe-par-la-projection',
      comment:
        'La couche temps réel ne court-circuite pas la projection : si elle touche le ' +
        'moteur, c’est par paquets/moteur/src/projection. Toute autre entrée du moteur ' +
        'depuis le transport permettrait de construire un message sortant sans passer ' +
        'par la frontière de sécurité (ADR-TL-09, RG-01).',
      severity: 'error',
      from: { path: '^applications/serveur/src/temps-reel' },
      to: {
        path: '^paquets/moteur/src',
        pathNot: '^paquets/moteur/src/projection',
      },
    },
    {
      name: 'serveur-sans-client',
      comment: 'Le serveur n’importe jamais le client.',
      severity: 'error',
      from: { path: '^applications/serveur' },
      to: { path: '^applications/client' },
    },
    {
      name: 'aucun-cycle',
      comment:
        'Une dépendance circulaire rend l’ordre d’initialisation implicite et le rejeu ' +
        'dépendant de l’ordre des imports.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'aucune-dependance-non-resolue',
      comment:
        'Un import non résolu signifie que la règle de couches n’a RIEN vérifié sur ce ' +
        'chemin : la porte doit se fermer, pas se taire.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],

  options: {
    doNotFollow: {
      path: ['node_modules'],
    },
    exclude: {
      path: ['\\.claude/', 'dist/', 'coverage/', 'rapports/', 'dev-dist/'],
    },
    // Indispensable : les amorces n'échangent pour l'instant que des TYPES.
    // Sans tsPreCompilationDeps, un `import type` est invisible et la règle de
    // couches ne vérifie rien.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['gdv-source', 'import', 'module', 'node', 'default', 'types'],
      extensions: ['.ts', '.mts', '.js', '.mjs', '.json', '.vue'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
    progress: { type: 'none' },
  },
};
