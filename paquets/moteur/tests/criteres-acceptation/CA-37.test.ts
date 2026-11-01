// CA-37 — US-14. Étant donné une partie en mode avancé après l'exécution de la
// manche 5, où EXACTEMENT 1 joueur signe, quand la résolution s'applique, alors
// le signataire reçoit 15 pièces, le génie est LIBÉRÉ, le Marchand déjà lié est
// déclaré vainqueur UNIQUE, et le Gardien de la lampe ÉCHOUE sa mission.
// (RG-51 à RG-56)

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants } from '@gdv/moteur';

import { allerAuDernierVoeu } from '../aide/mode-avance.ts';

test('CA-37 : le mode avancé s’ouvre après la manche 5, en phase DV_PROPOSITION', () => {
  const { table } = allerAuDernierVoeu();
  assert.equal(table.etat.etat_partie, 'DERNIER_VOEU');
  assert.equal(table.etat.phase, 'DV_PROPOSITION');
  assert.equal(table.etat.signatures.length, 6, 'une ligne de signature par joueur');
});

test('CA-37 : la proposition est PRIVÉE et porte le montant lu dans la configuration', () => {
  const { table } = allerAuDernierVoeu();
  // RUP-02 : la proposition est émise joueur par joueur et chaque effet part
  // aux N — chacun reçoit donc N trames, dont UNE SEULE est pleine : la sienne.
  // C'est ce qui rend le dénombrement muet.
  for (const joueur of table.joueurs) {
    const propositions = table.tramesPleinesDe(joueur, 'dernier_voeu_propose');
    assert.equal(propositions.length, 1);
    assert.equal(propositions[0]?.charge.montant_propose, 15);
    assert.deepEqual(Object.keys(propositions[0]?.charge ?? {}).sort(), [
      'montant_propose',
      'phase_fin_at',
    ]);
  }
});

test('CA-37 : un signataire unique encaisse 15, le génie est libéré', () => {
  const { table, marchandDejaLie, gardienDeLaLampe } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');

  const signataire = table.joueurs.find((joueur) => joueur !== marchandDejaLie) as string;
  const soldeAvant = table.solde(signataire);
  table.exiger(signataire, 'signer_dernier_voeu', { a_signe: true });
  for (const joueur of table.joueurs) {
    if (joueur === signataire) continue;
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: false });
  }

  table.expirer(); // expiration de DV_SIGNATURE : résolution puis scores

  assert.equal(table.etat.genie_libere, true);
  assert.equal(table.solde(signataire), soldeAvant + 15);
  assert.deepEqual(table.etat.vainqueurs, [marchandDejaLie], 'vainqueur UNIQUE (RG-56)');

  const gardien = table.etat.joueurs.find((joueur) => joueur.id === gardienDeLaLampe);
  assert.equal(gardien?.mission_reussie, false, 'le Gardien échoue si le génie est libéré');
  assert.ok(verifierInvariants(table.etat).ok);
});

test('CA-37 : le nombre de signataires est public, les identités ne le sont pas', () => {
  const { table, marchandDejaLie } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  const signataire = table.joueurs.find((joueur) => joueur !== marchandDejaLie) as string;
  table.exiger(signataire, 'signer_dernier_voeu', { a_signe: true });
  table.expirer();

  const resolutions = table.trames.filter((trame) => trame.type === 'dernier_voeu_resolu');
  assert.equal(resolutions.length, 6, 'public : un par joueur');
  for (const trame of resolutions) {
    assert.equal(trame.charge.nb_signataires, 1);
    assert.equal(trame.charge.consequence, 'SIGNATAIRE_UNIQUE_RECOMPENSE');
    assert.equal(trame.charge.genie_libere, true);
    assert.deepEqual(Object.keys(trame.charge).sort(), [
      'consequence',
      'genie_libere',
      'nb_signataires',
    ]);
  }
});

test('CA-37 : le MARCHAND_DEJA_LIE n’a pas de mission, et son rôle remplace la sienne', () => {
  const { table, marchandDejaLie } = allerAuDernierVoeu();
  const marchand = table.etat.joueurs.find((joueur) => joueur.id === marchandDejaLie);
  assert.equal(marchand?.role_secret, 'MARCHAND_DEJA_LIE');
  assert.equal(marchand?.mission_secrete, null, 'le rôle est reçu À LA PLACE de la mission');
});
