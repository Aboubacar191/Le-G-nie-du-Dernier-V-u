// La sonde de santé est interrogée, pas supposée.
// « Un service n'est démarré que si on l'a interrogé et qu'il a répondu. »
//
// Le test vérifie aussi le garde-fou de transport chiffré : en MODE=production
// sans certificat, le serveur doit REFUSER de démarrer
// (ARCHI standards.transport_chiffre).

import test from 'node:test';
import assert from 'node:assert/strict';

import { PREFIXE_REST } from '@gdv/partage';

import { creerServeur } from '../src/http/serveur.ts';
import { lireConfiguration, lireVersionProtocole } from '../src/configuration/index.ts';

/** Le chemin du contrat, préfixe compris (RUP-04). Jamais un littéral. */
const SANTE = `${PREFIXE_REST}/sante`;

test('GET /api/sante répond 200 avec le schéma EtatSante du contrat', async () => {
  const versionProtocole = lireVersionProtocole();
  const serveur = await creerServeur({ versionProtocole, maintenant: () => 1_762_000_000_000 });

  try {
    const reponse = await serveur.inject({ method: 'GET', url: SANTE });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json<Record<string, unknown>>();
    assert.deepEqual(Object.keys(corps).sort(), ['horodatage', 'statut', 'version_protocole']);
    assert.equal(corps.statut, 'ok');
    assert.equal(corps.version_protocole, versionProtocole);
    assert.match(String(corps.horodatage), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(reponse.headers['x-content-type-options'], 'nosniff');
    // ANO-10, versant serveur : l'engagement de non-mise-en-cache s'exprime par
    // le prédicat unique que RUP-04 rend possible, et il est VÉRIFIÉ sur le fil.
    assert.equal(reponse.headers['cache-control'], 'no-store');
  } finally {
    await serveur.close();
  }
});

/**
 * RUP-04 / ANO-11, cas NÉGATIF. Mesure QA : 0 route sur 6 portait le préfixe, et
 * l'écart était masqué par la réécriture du proxy de développement. Vérifier que
 * /api/sante répond ne suffit donc pas : il faut vérifier que la racine ne
 * répond PLUS, sans quoi les deux montages coexisteraient et le prédicat de
 * non-mise-en-cache redeviendrait faux.
 */
test('GET /sante, à la racine, n’est plus servie du tout (RUP-04)', async () => {
  const serveur = await creerServeur({ versionProtocole: lireVersionProtocole() });
  try {
    const reponse = await serveur.inject({ method: 'GET', url: '/sante' });
    assert.equal(reponse.statusCode, 404);
  } finally {
    await serveur.close();
  }
});

test('la sonde n’expose aucun compteur de sessions ni identifiant', async () => {
  const serveur = await creerServeur({ versionProtocole: lireVersionProtocole() });
  try {
    const corps = (await serveur.inject({ method: 'GET', url: SANTE })).json<
      Record<string, unknown>
    >();
    for (const interdit of ['sessions', 'nb_sessions', 'joueurs', 'id', 'session_id']) {
      assert.ok(!(interdit in corps), `la sonde expose « ${interdit} »`);
    }
  } finally {
    await serveur.close();
  }
});

test('MODE=production sans certificat : le serveur refuse de démarrer', () => {
  assert.throws(
    () => lireConfiguration({ MODE: 'production' }),
    /CHEMIN_CERT/,
    'le garde-fou de transport chiffré ne s’est pas déclenché',
  );
});

test('MODE=developpement démarre sans certificat', () => {
  const configuration = lireConfiguration({ MODE: 'developpement', PORT: '8443' });
  assert.equal(configuration.mode, 'developpement');
  assert.equal(configuration.port, 8443);
});
