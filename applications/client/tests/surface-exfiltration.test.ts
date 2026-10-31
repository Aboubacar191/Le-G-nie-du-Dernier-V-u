// PREUVE — la politique de sécurité de contenu n'ouvre plus de schéma nu, et le
// canal temps réel reste SAME-ORIGIN par construction (ANO-12).
//
// Le jeton de session vit en localStorage : une injection de script est son seul
// vecteur d'exfiltration, et la CSP est présentée comme le rempart. Une
// directive connect-src qui énumère une FAMILLE DE SCHÉMAS plutôt que des
// origines n'est pas un rempart : « wss: » autorise l'émission vers n'importe
// quel hôte, et il suffit d'un script injecté pour ouvrir
// wss://hote-de-l-attaquant/ et y verser le jeton.
//
// Les deux contrôles vont ensemble. Restreindre connect-src à 'self' ne tient
// que parce que l'origine de la socket est dérivée de location.host et jamais
// d'une valeur reçue du serveur : si quelqu'un se mettait à faire confiance à
// une URL absolue envoyée par le serveur, 'self' casserait le jeu au lieu de le
// protéger. Le second test verrouille donc cette hypothèse.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAQUET = resolve(ICI, '..');

const indexHtml = readFileSync(resolve(PAQUET, 'index.html'), 'utf8');
const session = readFileSync(resolve(PAQUET, 'src', 'magasin', 'session.ts'), 'utf8');

/** Directives de la CSP déclarée dans index.html, par nom. */
function politique(): ReadonlyMap<string, readonly string[]> {
  const balise = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u.exec(indexHtml);
  assert.ok(balise !== null, 'aucune Content-Security-Policy dans index.html');
  const directives = new Map<string, readonly string[]>();
  for (const brute of (balise[1] ?? '').split(';')) {
    const morceaux = brute.trim().split(/\s+/u).filter((morceau) => morceau !== '');
    const [nom, ...valeurs] = morceaux;
    if (nom !== undefined) directives.set(nom, valeurs);
  }
  return directives;
}

test('aucune directive de la CSP n’autorise un SCHÉMA NU', () => {
  // « wss: », « https: », « data: » sur une directive de récupération de script
  // ou de connexion ouvrent une famille d'hôtes entière. data: reste admis sur
  // img-src, où il sert au code QR et ne permet aucune exfiltration.
  const toleres = new Map([['img-src', ['data:']]]);
  const fautifs: string[] = [];

  for (const [nom, valeurs] of politique()) {
    for (const valeur of valeurs) {
      if (!/^[a-z][a-z0-9+.-]*:$/u.test(valeur)) continue;
      if ((toleres.get(nom) ?? []).includes(valeur)) continue;
      fautifs.push(`${nom} → ${valeur}`);
    }
  }

  assert.deepEqual(
    fautifs,
    [],
    `schémas nus dans la CSP : ${fautifs.join(', ')} — une directive doit énumérer ` +
      'des ORIGINES, pas une famille de schémas',
  );
});

test('connect-src est restreint à l’origine du document', () => {
  const valeurs = politique().get('connect-src');
  assert.deepEqual(
    valeurs,
    ["'self'"],
    'connect-src doit valoir exactement \'self\' : le canal temps réel est same-origin ' +
      'par construction, aucune autre origine n’a de raison d’être joignable',
  );
});

test('la CSP conserve les quatre verrous déjà en place', () => {
  const attendus: readonly (readonly [string, string])[] = [
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'none'"],
    ['script-src', "'self'"],
  ];
  const politiqueCourante = politique();
  for (const [nom, valeur] of attendus) {
    assert.deepEqual(politiqueCourante.get(nom), [valeur], `${nom} doit valoir ${valeur}`);
  }
  // Les polices sont désormais embarquées : la directive est explicite plutôt
  // que laissée au repli sur default-src.
  assert.deepEqual(politiqueCourante.get('font-src'), ["'self'"]);
});

test('l’origine du canal temps réel vient de location, JAMAIS du serveur', () => {
  // C'est l'hypothèse qui rend connect-src 'self' suffisant. Si le serveur
  // pouvait imposer une origine, 'self' casserait la partie — ou il faudrait
  // rouvrir la CSP, ce qui ramènerait la faille.
  assert.match(
    session,
    /globalThis\.location\?\.host/u,
    'l’origine de la socket doit être dérivée de location.host',
  );
  assert.match(
    session,
    /url:\s*`\$\{origine\}\$\{jeton\.url_temps_reel\}`/u,
    'url_temps_reel du serveur doit être employée comme CHEMIN, concaténée après ' +
      'une origine locale — jamais comme URL absolue',
  );
  assert.ok(
    !/url:\s*jeton\.url_temps_reel/u.test(session),
    'une URL absolue reçue du serveur deviendrait une origine de connexion non ' +
      'contrôlée, et rendrait connect-src inopérant',
  );
});
