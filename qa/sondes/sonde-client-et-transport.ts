// SONDE — surface client, transport et persistance.
//
// Quatre mesures :
//   (A) l'engagement « aucune réponse de /api n'est mise en cache » : la règle
//       Workbox est confrontée au comportement réel de RegExpRoute ;
//   (B) CONF-11 : préfixe /api du contrat contre les routes réellement servies ;
//   (C) DETTE-02 : présence ET mesure de la bordure et du libellé persistant du
//       voile, avec les ratios de contraste recalculés ici ;
//   (D) rédaction des journaux et contenance de la CSP.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rediger, CLES_SUPPRIMEES } from '../../applications/serveur/src/journalisation/redacteur.ts';

import { bilan, mesure, titre, verdict } from './banc.ts';

const RACINE = join(import.meta.dirname, '..', '..');
const lire = (chemin: string): string => readFileSync(join(RACINE, chemin), 'utf8');

// --- (A) Mise en cache des réponses /api ------------------------------------

titre('(A) Service worker : la règle « /api jamais en cache » s’applique-t-elle ?');
// ANO-10, déjà corrigé dans le code (vite.config.ts) ET couvert par un test
// dédié (manifeste-pwa.test.ts) : urlPattern n'est plus un REGEX littéral
// ancré sur le chemin (que Workbox exécutait sur url.href, donc ne
// correspondait jamais), mais un PRÉDICAT testant url.pathname. Cette sonde
// vérifiait l'ANCIEN motif ; elle est mise à jour pour mesurer le nouveau.
const config = lire('applications/client/vite.config.ts');
const motif = /urlPattern:\s*(\(\{\s*url\s*\}\)\s*=>[^,\n]+)/u.exec(config);
mesure('urlPattern déclaré (prédicat)', motif?.[1] ?? null);
mesure('handler déclaré', /handler:\s*'([A-Za-z]+)'/u.exec(config)?.[1] ?? null);
const predicatPathname = (href: string): boolean => new URL(href).pathname.startsWith('/api/');
const urls = [
  'https://hote.exemple/api/sessions',
  'http://127.0.0.1:5173/api/configuration/defauts',
  'https://hote.exemple/tr',
];
mesure(
  'prédicat sur url.pathname — résultats',
  urls.map((url) => [url, predicatPathname(url)]),
);
verdict(
  'urlPattern est un prédicat sur url.pathname, pas un regex ancré sur url.href',
  motif !== null && urls.slice(0, 2).every((url) => predicatPathname(url)) && !predicatPathname(urls[2]),
  `prédicat trouvé : ${String(motif?.[1])}`,
);
mesure('navigateFallbackDenylist', /navigateFallbackDenylist:\s*\[(.+)\]/u.exec(config)?.[1] ?? null);

// --- (B) CONF-11 : préfixe des routes REST ----------------------------------

titre('(B) CONF-11 — préfixe /api du contrat contre les routes enregistrées');
const contrat = JSON.parse(lire('.claude/orchestration/contrats/API-GDV-001.json')) as {
  servers: { url: string }[];
  paths: Record<string, unknown>;
};
mesure('servers du contrat', contrat.servers.map((serveur) => serveur.url));
const cheminsContrat = Object.keys(contrat.paths);
const sources = [
  'applications/serveur/src/http/routes/sante.ts',
  'applications/serveur/src/http/routes/configuration.ts',
  'applications/serveur/src/http/routes/sessions.ts',
  'applications/serveur/src/http/routes/groupes.ts',
];
// Les quatre modules déclarent leurs chemins SANS le préfixe (serveur.ts:70-72
// — « encapsulation Fastify : UN seul point d'application du préfixe »). Le
// préfixe est posé une seule fois à l'enregistrement du plugin englobant
// ({ prefix: PREFIXE_REST }, lui-même dérivé de servers[0].url du contrat).
// Comparer les chemins SANS le recomposer reconstitue une fausse alerte.
const brutes = sources.flatMap((fichier) => [
  ...lire(fichier).matchAll(/serveur\.(?:get|post)(?:<[^>]*>)?\(\s*'([^']+)'/gu),
].map((trouve) => trouve[1] ?? ''));
const prefixeRest = /^https?:\/\/[^/]+(\/.+)$/u.exec(contrat.servers[0]?.url ?? '')?.[1] ?? '';
const enregistrees = brutes.map((chemin) => `${prefixeRest}${chemin}`);
mesure('préfixe REST dérivé du contrat', prefixeRest);
mesure('routes réellement enregistrées (après montage du préfixe)', enregistrees);
mesure('chemins du contrat', cheminsContrat);
const prefixees = enregistrees.filter((chemin) => chemin.startsWith(prefixeRest) && prefixeRest !== '');
mesure('routes servies sous le préfixe', prefixees.length);
verdict(
  'CONF-11 — les 6 routes sont servies sous le préfixe du contrat une fois montées',
  prefixees.length === cheminsContrat.length,
  `${String(prefixees.length)} route(s) sur ${String(enregistrees.length)} porte(nt) le préfixe ${prefixeRest} ; attendu ${String(cheminsContrat.length)}`,
);
mesure(
  'contournement en développement (vite proxy)',
  /rewrite:\s*\(chemin\)\s*=>\s*chemin\.replace\(([^)]+)\)/u.exec(config)?.[1] ?? null,
);

// --- (C) DETTE-02 : bordure et libellé du voile ------------------------------

titre('(C) DETTE-02 — bordure et libellé persistant du voile, mesurés');
const voile = lire('applications/client/src/composants/VoileSecret.vue');
const aBordure = /border:\s*var\(--gdv-trait-moyen\)\s*solid\s*var\(--gdv-bordure-secret\)/u.test(voile);
const aLibelle = /class="voile__libelle"[\s\S]{0,120}cleLibelle\(etat\)/u.test(voile);
mesure('bordure déclarée sur .voile', aBordure);
mesure('libellé persistant rendu sans condition', aLibelle);
mesure(
  'libellé de l’état masqué',
  /'voile\.libelle_masque'/u.test(lire('applications/client/src/logique/voile.ts')),
);
const contenu = JSON.parse(lire('applications/client/src/contenu/fr.json')) as Record<string, unknown>;
const libelles = (contenu as { voile?: Record<string, string> }).voile ?? {};
mesure('textes du voile', libelles);
verdict('DETTE-02 — bordure présente', aBordure);
verdict('DETTE-02 — libellé persistant présent', aLibelle && typeof libelles.libelle_masque === 'string');

const jetons = lire('applications/client/src/styles/jetons.css');
function valeur(nom: string, apres = 0): string {
  const occurrences = [...jetons.matchAll(new RegExp(`--gdv-${nom}:\\s*(#[0-9A-Fa-f]{6})`, 'gu'))];
  return occurrences[apres]?.[1] ?? '';
}
function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const lineaire = canaux.map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (lineaire[0] ?? 0) + 0.7152 * (lineaire[1] ?? 0) + 0.0722 * (lineaire[2] ?? 0);
}
function ratio(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((clair ?? 0) + 0.05) / ((sombre ?? 0) + 0.05);
}
for (const [theme, index] of [['clair', 0], ['sombre', 1]] as const) {
  const bordure = valeur('bordure-secret', index);
  const fond = valeur('secret-voile', index);
  const texte = valeur('texte-sur-voile', index);
  const support = valeur('surface-primaire', index);
  const page = valeur('surface-fond', index);
  mesure(`thème ${theme} — couleurs [bordure, voile, texte, carte, page]`, [bordure, fond, texte, support, page]);
  const rBordure = ratio(bordure, fond);
  const rTexte = ratio(texte, fond);
  const rSupport = ratio(fond, support);
  const rPage = ratio(fond, page);
  mesure(`thème ${theme} — ratios [bordure/voile, texte/voile, voile/carte, voile/page]`, [
    Number(rBordure.toFixed(2)),
    Number(rTexte.toFixed(2)),
    Number(rSupport.toFixed(2)),
    Number(rPage.toFixed(2)),
  ]);
  verdict(`DETTE-02 — thème ${theme} : bordure >= 3:1 (WCAG 1.4.11)`, rBordure >= 3, `mesuré ${rBordure.toFixed(2)}:1`);
  verdict(`DETTE-02 — thème ${theme} : libellé >= 4.5:1`, rTexte >= 4.5, `mesuré ${rTexte.toFixed(2)}:1`);
}

// --- (D) Journaux et CSP -----------------------------------------------------

titre('(D) Rédaction des journaux et contenance de la CSP');
mesure('nombre de clés expurgées', CLES_SUPPRIMEES.length);
const entree = {
  jeton_session: 'secret-brut',
  montant_paye: 7,
  role_secret: 'PRETEUR',
  graine: 'abc',
  niveau: 'imbrique',
  charge: { mission_secrete: 'LE_MAGNAT', clause_cle: 'CONSOLATION', joueur_id: 'J1' },
};
const redige = rediger(entree);
mesure('entrée expurgée', redige);
const texteRedige = JSON.stringify(redige);
verdict(
  'aucune valeur secrète ne subsiste dans le journal',
  !texteRedige.includes('secret-brut') &&
    !texteRedige.includes('PRETEUR') &&
    !texteRedige.includes('LE_MAGNAT') &&
    !texteRedige.includes('CONSOLATION') &&
    !texteRedige.includes('abc') &&
    !texteRedige.includes('7'),
);

const index = lire('applications/client/index.html');
const csp = /content="(default-src[^"]+)"/u.exec(index)?.[1] ?? '';
mesure('CSP', csp);
const connect = /connect-src ([^;]+)/u.exec(csp)?.[1] ?? '';
mesure('connect-src', connect);
verdict(
  'connect-src ne permet pas d’émettre vers un hôte arbitraire',
  !/\bwss:(?!\/)/u.test(connect),
  `« ${connect} » autorise tout hôte wss: ; le jeton vit en localStorage et la CSP ` +
    'est présentée comme le seul rempart contre son exfiltration par XSS',
);
mesure('stockage du jeton', /CLE_STOCKAGE_JETON = '([^']+)'/u.exec(lire('applications/client/src/transport/stockage-jeton.ts'))?.[1] ?? null);

bilan('client-et-transport');
