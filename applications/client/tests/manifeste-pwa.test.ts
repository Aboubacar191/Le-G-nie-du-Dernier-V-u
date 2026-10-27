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

test('les couleurs du manifeste sont des gris neutres (ESC-01 ouverte)', () => {
  for (const cle of ['theme_color', 'background_color']) {
    const valeur: string = manifeste[cle];
    assert.match(valeur, /^#[0-9a-f]{6}$/i, `${cle} doit être une couleur hexadécimale`);
    const r = Number.parseInt(valeur.slice(1, 3), 16);
    const v = Number.parseInt(valeur.slice(3, 5), 16);
    const b = Number.parseInt(valeur.slice(5, 7), 16);
    const ecart = Math.max(r, v, b) - Math.min(r, v, b);
    assert.ok(
      ecart <= 16,
      `${cle} = ${valeur} n'est pas neutre (écart RVB ${ecart}) : trancher l'univers ` +
        `est une décision utilisateur (ESC-01), pas un choix du squelette.`,
    );
  }
});

test('aucune réponse de /api n’est mise en cache par le service worker', () => {
  assert.match(configurationVite, /urlPattern:\s*\/\^\\\/api/);
  assert.match(configurationVite, /handler:\s*'NetworkOnly'/);
  assert.ok(
    !/handler:\s*'(CacheFirst|StaleWhileRevalidate|NetworkFirst)'/.test(configurationVite),
    'une stratégie de cache a été introduite : vérifier qu’elle n’atteint pas /api',
  );
});

test('la mise à jour du service worker est en mode « prompt »', () => {
  assert.match(configurationVite, /registerType:\s*'prompt'/);
  assert.ok(
    !/skipWaiting:\s*true/.test(configurationVite),
    'skipWaiting remplacerait l’application sous les doigts du joueur en pleine phase',
  );
});
