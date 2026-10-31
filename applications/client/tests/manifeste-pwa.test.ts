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
