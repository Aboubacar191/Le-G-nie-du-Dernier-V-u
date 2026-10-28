// CA-38 — US-14. Étant donné une partie en mode avancé où 3 joueurs signent,
// quand la résolution s'applique, alors AUCUN ne reçoit de pièces, chacun perd
// plancher(solde / 2), le génie n'est PAS libéré et le Gardien de la lampe
// RÉUSSIT. (RG-53)

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants } from '@gdv/moteur';

import { allerAuDernierVoeu } from '../aide/mode-avance.ts';

test('CA-38 : contrat contesté — chaque signataire perd la moitié de ses pièces', () => {
  const { table, gardienDeLaLampe } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');

  const signataires = ['J0', 'J1', 'J2'];
  const soldesAvant = new Map(signataires.map((joueur) => [joueur, table.solde(joueur)]));
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'signer_dernier_voeu', {
      a_signe: signataires.includes(joueur),
    });
  }

  table.expirer();

  assert.equal(table.etat.genie_libere, false);
  for (const joueur of signataires) {
    const avant = soldesAvant.get(joueur) ?? 0;
    assert.equal(table.solde(joueur), avant - Math.floor(avant / 2), `sanction de ${joueur}`);
  }
  for (const joueur of table.joueurs.filter((candidat) => !signataires.includes(candidat))) {
    assert.equal(table.solde(joueur), 12, 'les non-signataires ne perdent rien');
  }

  const gardien = table.etat.joueurs.find((joueur) => joueur.id === gardienDeLaLampe);
  assert.equal(gardien?.mission_reussie, true, 'le Gardien réussit si le génie reste enfermé');
  assert.ok(verifierInvariants(table.etat).ok);
});

test('CA-38 : la conséquence publique est CONTRAT_CONTESTE, sans montant individuel', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: ['J0', 'J1', 'J2'].includes(joueur) });
  }
  table.expirer();

  const resolutions = table.trames.filter((trame) => trame.type === 'dernier_voeu_resolu');
  for (const trame of resolutions) {
    assert.equal(trame.charge.nb_signataires, 3);
    assert.equal(trame.charge.consequence, 'CONTRAT_CONTESTE');
    assert.equal(trame.charge.genie_libere, false);
  }
});

test('CA-38 : avec 2 signataires aussi, le contrat est contesté', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: ['J0', 'J1'].includes(joueur) });
  }
  table.expirer();
  assert.equal(table.etat.genie_libere, false);
  assert.equal(table.solde('J0'), 6);
  assert.equal(table.solde('J1'), 6);
});

test('CA-38 : un second envoi de signature est refusé (RG-70)', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
  const resultat = table.cmd('J0', 'signer_dernier_voeu', { a_signe: false });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'DEJA_SOUMIS');
});

test('CA-38 : signer hors du mode avancé est refusé avec MODE_AVANCE_INACTIF', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.etat = { ...table.etat, mode_avance_actif: false };
  const resultat = table.cmd('J0', 'signer_dernier_voeu', { a_signe: true });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'MODE_AVANCE_INACTIF');
});
