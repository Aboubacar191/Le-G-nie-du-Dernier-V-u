// CA-37 — US-14. Étant donné une partie en mode avancé après l'exécution de la
// manche 5, où EXACTEMENT 1 joueur signe, quand la résolution s'applique, alors
// le signataire reçoit 15 pièces, le génie est LIBÉRÉ, et le Gardien de la
// lampe ÉCHOUE sa mission. (RG-51 à RG-56)
//
// CORRIGÉ (conseil LLM, 2026-11-15, scores/classement.ts) : le Marchand déjà
// lié n'est vainqueur UNIQUE que s'IL est lui-même ce signataire — pas
// « quiconque signe seul ». AVANT ce correctif, ce fichier posait un
// signataire DIFFÉRENT du Marchand déjà lié et affirmait pourtant que ce
// dernier gagnait : c'était le bogue lui-même, encodé comme comportement
// voulu. Deux scénarios distincts, désormais : le Marchand déjà lié signe
// lui-même (il gagne), un autre joueur signe seul (il ne gagne PAS
// automatiquement — RG-56 ne dispense personne du risque personnel).

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

test('CA-37 : le Marchand déjà lié signe lui-même, il encaisse 15 et gagne seul', () => {
  const { table, marchandDejaLie, gardienDeLaLampe } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');

  const soldeAvant = table.solde(marchandDejaLie);
  table.exiger(marchandDejaLie, 'signer_dernier_voeu', { a_signe: true });
  for (const joueur of table.joueurs) {
    if (joueur === marchandDejaLie) continue;
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: false });
  }

  table.expirer(); // expiration de DV_SIGNATURE : résolution puis scores

  assert.equal(table.etat.genie_libere, true);
  assert.equal(table.solde(marchandDejaLie), soldeAvant + 15);
  assert.deepEqual(table.etat.vainqueurs, [marchandDejaLie], 'vainqueur UNIQUE (RG-56)');

  const gardien = table.etat.joueurs.find((joueur) => joueur.id === gardienDeLaLampe);
  assert.equal(gardien?.mission_reussie, false, 'le Gardien échoue si le génie est libéré');
  assert.ok(verifierInvariants(table.etat).ok);
});

test('CA-37 : un AUTRE joueur signe seul — le Marchand déjà lié ne gagne PAS automatiquement', () => {
  // Correctif du conseil LLM (2026-11-15) : avant, genie_libere seul
  // suffisait à faire gagner le Marchand déjà lié, quel que soit le
  // signataire réel — une stratégie à risque nul (ne jamais signer soi-même,
  // manœuvrer pour qu'un tiers le fasse). RG-56 dit « indépendamment du
  // classement par points », pas « indépendamment de qui a signé ».
  const { table, marchandDejaLie } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');

  const signataire = table.joueurs.find((joueur) => joueur !== marchandDejaLie) as string;
  table.exiger(signataire, 'signer_dernier_voeu', { a_signe: true });
  for (const joueur of table.joueurs) {
    if (joueur === signataire) continue;
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: false });
  }

  table.expirer();

  assert.equal(table.etat.genie_libere, true, 'fait narratif : le génie EST libre');
  assert.notDeepEqual(
    table.etat.vainqueurs,
    [marchandDejaLie],
    'le Marchand déjà lié ne gagne pas sans avoir lui-même pris le risque de signer',
  );
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
