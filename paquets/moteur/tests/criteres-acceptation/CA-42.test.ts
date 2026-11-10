// CA-42 — US-16. Étant donné un joueur déconnecté en phase
// ENQUETES_ACCUSATIONS puis reconnecté avec son jeton, quand il reçoit l'état
// complet projeté, alors il retrouve son rôle, sa mission, son solde, ses
// résultats d'enquête et la phase en cours avec son échéance, et l'état reçu ne
// contient AUCUN secret d'autrui. (RG-73)
//
// La reprise se fait par RE-PROJECTION complète, jamais par rejeu de messages
// passés : un message projeté pour un état antérieur serait une projection
// périmée (API / politique_de_rejeu).

import test from 'node:test';
import assert from 'node:assert/strict';

import { definirConnexion } from '@gdv/moteur';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

function tableAvecEnqueteEtDeconnexion(): Table {
  const table = tableEnDeclaration({ joueurs: 6, graine: 'ca-42' });
  table.imposerRole('J0', 'PRETEUR');
  table.declarerEtPayer([
    [4, 4],
    [5, 2],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  table.exiger('J2', 'accuser', { accuse_joueur_id: 'J1' });
  // Déconnexion : la partie continue, le joueur n'est jamais éliminé (RG-46).
  table.etat = definirConnexion(table.etat, 'J0', false);
  return table;
}

test('CA-42 : l’état projeté complet rend au joueur TOUT ce qui lui appartient', () => {
  const table = tableAvecEnqueteEtDeconnexion();
  table.etat = definirConnexion(table.etat, 'J0', true);

  const vue = table.vuePrivee('J0');
  assert.notEqual(vue, null);
  const moi = vue?.moi as {
    joueur_id: string;
    role_secret: string | null;
    mission_secrete: string | null;
    solde_pieces: number;
    montant_declare: number | null;
    montant_paye: number | null;
    mes_enquetes_de_la_manche: { cible_joueur_id: string; montant_paye: number }[];
    a_accuse_cette_manche: boolean;
  };

  assert.equal(moi.joueur_id, 'J0');
  assert.equal(moi.role_secret, 'PRETEUR');
  assert.notEqual(moi.mission_secrete, null);
  assert.equal(moi.solde_pieces, table.solde('J0'));
  assert.equal(moi.montant_declare, 4);
  assert.equal(moi.montant_paye, 4, 'son propre paiement, jamais celui d’un autre');
  assert.equal(moi.mes_enquetes_de_la_manche.length, 1);
  assert.equal(moi.mes_enquetes_de_la_manche[0]?.cible_joueur_id, 'J1');
  assert.equal(moi.mes_enquetes_de_la_manche[0]?.montant_paye, 2, 'le résultat acheté');
  assert.equal(moi.a_accuse_cette_manche, false);

  assert.equal(vue?.phase, 'ENQUETES_ACCUSATIONS');
  assert.equal(typeof vue?.phase_fin_at, 'string', 'l’échéance absolue de la phase');
});

test('CA-42 : l’état reçu ne contient AUCUN secret d’autrui', () => {
  const table = tableAvecEnqueteEtDeconnexion();
  const vue = table.vuePrivee('J0');
  const serialise = JSON.stringify(vue);

  // Les rôles et missions des autres n'y figurent pas (sauf coïncidence de
  // valeur avec les siens, qui n'est pas une fuite).
  const moi = table.etat.joueurs.find((joueur) => joueur.id === 'J0');
  const miens = new Set<string | null | undefined>([moi?.role_secret, moi?.mission_secrete]);
  for (const autre of table.etat.joueurs.filter((joueur) => joueur.id !== 'J0')) {
    for (const secret of [autre.role_secret, autre.mission_secrete]) {
      if (secret === null || miens.has(secret)) continue;
      assert.ok(!serialise.includes(secret), `le secret ${secret} d’autrui est dans la vue`);
    }
  }

  // Les joueurs publics ne portent ni solde, ni rôle, ni mission.
  const joueurs = vue?.joueurs as Record<string, unknown>[];
  for (const joueur of joueurs) {
    assert.deepEqual(Object.keys(joueur).sort(), [
      'connecte',
      'est_hote',
      'joueur_id',
      'offrande_scellee',
      'position_cercle',
      'pret',
      'pseudo',
    ]);
  }
});

test('CA-42 : l’historique ne contient aucun paiement d’autrui, même sur manche close', () => {
  const table = tableAvecEnqueteEtDeconnexion();
  table.allerA('EXECUTION');
  table.expirer();

  const vue = table.vuePrivee('J2');
  const historique = vue?.historique_manches as Record<string, unknown>[];
  assert.equal(historique.length, 1);
  const resume = historique[0] as { declarations: unknown[]; total_paye: number };
  // Le TOTAL payé est public depuis la phase REVELATION ; les paiements
  // INDIVIDUELS d'autrui ne sont nulle part.
  assert.equal(resume.total_paye, 18);
  const serialise = JSON.stringify(resume);
  assert.ok(!serialise.includes('montant_paye'));
});

test('CA-42 : la vue privée de l’hôte porte l’état du groupe, celle des autres non', () => {
  const table = tableAvecEnqueteEtDeconnexion();
  const vueHote = table.vuePrivee('J0');
  const vueAutre = table.vuePrivee('J1');
  assert.notEqual(vueHote?.groupe, null, 'J0 est l’hôte');
  assert.equal(vueAutre?.groupe, null, 'aucun autre joueur ne voit le groupe');
});

test('CA-42 : un identifiant inconnu ne reçoit RIEN, pas une vue amputée', () => {
  const table = tableAvecEnqueteEtDeconnexion();
  assert.equal(table.vuePrivee('INCONNU'), null);
});
