// Le manifeste et la stratégie de cache sont des engagements de sécurité, pas
// des détails de confort : ils sont donc vérifiés.
//
//  · Aucune réponse de /api ne doit être mise en cache : une projection privée
//    en cache serait lisible après coup sur un téléphone prêté.
//  · registerType « prompt » : une mise à jour appliquée en pleine phase
//    DECLARATION_PAIEMENT ferait manquer sa déclaration au joueur.
//  · theme_color et background_color restent des gris neutres tant qu'ESC-01
//    n'est pas tranchée.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAQUET = resolve(ICI, '..');

const manifeste = JSON.parse(
  readFileSync(resolve(PAQUET, 'public', 'manifest.webmanifest'), 'utf8'),
);
const configurationVite = readFileSync(resolve(PAQUET, 'vite.config.ts'), 'utf8');

test('le manifeste PWA déclare ce qu’exige strategie_pwa', () => {
  assert.equal(manifeste.display, 'standalone');
  assert.equal(manifeste.orientation, 'portrait');
  assert.equal(manifeste.start_url, '/');
  assert.equal(manifeste.scope, '/');

  const tailles = manifeste.icons.map((icone: { sizes: string }) => icone.sizes);
  assert.ok(tailles.includes('192x192'), 'icône 192 manquante');
  assert.ok(tailles.includes('512x512'), 'icône 512 manquante');
  assert.ok(
    manifeste.icons.some((icone: { purpose?: string }) => icone.purpose === 'maskable'),
    'icône maskable manquante',
  );
});

// ESC-01 est TRANCHÉE (univers Zafyr) : l'exigence de gris neutre est périmée et
// remplacée par son contraire utile. Les deux couleurs du manifeste sont les
// SEULES copies littérales d'un jeton dans tout le client — un manifeste PWA est
// lu par le système d'exploitation avant tout CSS, il n'accepte ni var() ni
// requête de média. Une copie littérale non surveillée dérive ; celle-ci est
// désormais comparée au contrat, et le test échoue si le contrat bouge seul.
test('les couleurs du manifeste sont celles du contrat de conception', () => {
  const design = JSON.parse(
    readFileSync(
      resolve(PAQUET, '..', '..', '.claude', 'orchestration', 'contrats', 'DESIGN-GDV-001.json'),
      'utf8',
    ),
  ) as { tokens: { couleur: { theme_sombre: Record<string, string> } } };
  const attendu = design.tokens.couleur.theme_sombre['surface-fond'];

  for (const cle of ['theme_color', 'background_color']) {
    const valeur: string = manifeste[cle];
    assert.match(valeur, /^#[0-9a-f]{6}$/i, `${cle} doit être une couleur hexadécimale`);
    assert.equal(
      valeur,
      attendu,
      `${cle} doit valoir tokens.couleur.theme_sombre.surface-fond (${String(attendu)}) : ` +
        `l'écran de démarrage de la PWA précède l'écran de lancement, qui est sombre`,
    );
  }
});

// ANO-10 — l'ancienne assertion était « assert.match(config, /urlPattern: \/\^\\\/api/) ».
// Elle vérifiait que le motif bogué était bien présent : elle encodait le défaut
// au lieu de le détecter. Workbox exécute le motif sur url.href et non sur le
// chemin, si bien que /^\/api\// ne correspondait à AUCUNE URL réelle.
// Le contrôle ÉVALUE désormais le prédicat, sur les trois URL mesurées par le QA.
test('la règle « /api jamais en cache » S’APPLIQUE à une URL réelle', () => {
  const extrait = /urlPattern:\s*(\(\{\s*url\s*\}\)\s*=>[^,\n]+)/u.exec(configurationVite);
  assert.ok(extrait !== null, 'urlPattern doit être un prédicat sur l’URL analysée');

  // `new Function` n'offre QUE la portée globale : si le prédicat référençait un
  // import ou une constante du fichier, l'évaluation lèverait ici. C'est la
  // preuve de son autonomie — exigence réelle, parce que workbox-build le
  // sérialise tel quel dans sw.js, où aucun import n'existe.
  const predicat = new Function(`return ${extrait[1] ?? ''};`)() as (
    entree: { url: URL },
  ) => boolean;

  const mesurees = [
    'https://hote.exemple/api/sessions',
    'http://127.0.0.1:5173/api/configuration/defauts',
    '/api/sessions',
  ];
  for (const brute of mesurees) {
    const url = new URL(brute, 'http://127.0.0.1:5173');
    assert.equal(predicat({ url }), true, `${brute} doit être couverte par NetworkOnly`);
  }
  // Et la règle ne doit pas happer tout le reste : un faux positif ferait sortir
  // du cache des ressources qui doivent y rester (coquille, polices, icônes).
  for (const hors of ['https://hote.exemple/', 'https://hote.exemple/polices/cinzel-latin.woff2']) {
    assert.equal(predicat({ url: new URL(hors) }), false, `${hors} ne relève pas de /api`);
  }

  assert.match(configurationVite, /handler:\s*'NetworkOnly'/);
  assert.ok(
    !/handler:\s*'(CacheFirst|StaleWhileRevalidate|NetworkFirst)'/.test(configurationVite),
    'une stratégie de cache a été introduite : vérifier qu’elle n’atteint pas /api',
  );
});

// RUP-04 — la réécriture du proxy et le préfixe servi par le serveur forment un
// COUPLE : préfixer sans retirer casse le développement, retirer sans préfixer
// le casse aussi. Le serveur préfixe désormais ses six routes sous /api
// (applications/serveur/src/http/serveur.ts, PREFIXE_REST), donc la réécriture
// est RETIRÉE et doit le rester. Le sens de ce test est INVERSÉ par rapport à
// l'itération précédente, et c'est la livraison conjointe des deux correctifs
// qui l'autorise : x-prefixe-rest.interdiction_de_contournement est normatif,
// « la réécriture est INTERDITE et doit être retirée avec le correctif ».
test('la réécriture /api du proxy de développement est RETIRÉE (RUP-04)', () => {
  assert.ok(
    !/rewrite\s*:/u.test(configurationVite),
    'une réécriture de préfixe dans le proxy de développement fait de vite.config.ts une ' +
      'seconde source de vérité : l’écart redeviendrait invisible en développement et ' +
      'total en production, ce qui est exactement ANO-11',
  );
  assert.ok(
    !/pathRewrite/u.test(configurationVite),
    'pathRewrite est la même réécriture sous un autre nom',
  );
  // Le proxy doit bien rester déclaré : l'absence de réécriture ne doit pas
  // être obtenue en supprimant le proxy, ce qui casserait le développement.
  assert.match(configurationVite, /'\/api':\s*\{/u);
});

test('la mise à jour du service worker est en mode « prompt »', () => {
  assert.match(configurationVite, /registerType:\s*'prompt'/);
  assert.ok(
    !/skipWaiting:\s*true/.test(configurationVite),
    'skipWaiting remplacerait l’application sous les doigts du joueur en pleine phase',
  );
});
