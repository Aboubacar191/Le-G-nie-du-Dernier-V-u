// CA-39 — US-14. Étant donné une phase DV_SIGNATURE en cours, quand on inspecte
// les messages reçus par un joueur NON signataire, alors aucun ne révèle la
// signature d'un autre joueur ; seul le DÉCOMPTE final est publié à la
// résolution. (RG-54)

import test from 'node:test';
import assert from 'node:assert/strict';

import { allerAuDernierVoeu } from '../aide/mode-avance.ts';

test('CA-39 : une signature ne produce AUCUNE trame, pas même vers son auteur', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');

  const avant = table.trames.length;
  table.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
  assert.equal(
    table.trames.length,
    avant,
    'aucun effet projetable : tout message trahirait qu’un joueur vient d’agir',
  );
});

test('CA-39 : aucun joueur n’apprend la signature d’un autre pendant DV_SIGNATURE', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
  table.exiger('J1', 'signer_dernier_voeu', { a_signe: false });

  for (const joueur of table.joueurs) {
    const serialise = JSON.stringify(table.tramesDe(joueur));
    assert.ok(!serialise.includes('a_signe'), `${joueur} reçoit un champ a_signe`);
    assert.ok(!serialise.includes('signataire'), `${joueur} reçoit une mention de signataire`);
  }
});

test('CA-39 : chacun ne voit que SA propre signature dans sa vue privée', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
  table.exiger('J1', 'signer_dernier_voeu', { a_signe: false });

  const vueJ0 = table.vuePrivee('J0');
  const moiJ0 = vueJ0?.moi as { ma_signature_dernier_voeu: boolean | null };
  assert.equal(moiJ0.ma_signature_dernier_voeu, true);

  const vueJ1 = table.vuePrivee('J1');
  const moiJ1 = vueJ1?.moi as { ma_signature_dernier_voeu: boolean | null };
  assert.equal(moiJ1.ma_signature_dernier_voeu, false);

  const vueJ2 = table.vuePrivee('J2');
  const moiJ2 = vueJ2?.moi as { ma_signature_dernier_voeu: boolean | null };
  assert.equal(moiJ2.ma_signature_dernier_voeu, null, 'rien n’est soumis pour J2');
  // Et nulle part ailleurs dans sa vue ne figure la signature d'un autre.
  assert.ok(!JSON.stringify(vueJ2?.joueurs).includes('signature'));
});

test('CA-39 : les identités ne sortent qu’à l’écran de scores finaux (RG-58)', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'signer_dernier_voeu', { a_signe: joueur === 'J0' });
  }
  table.expirer();

  const scores = table.trames.filter((trame) => trame.type === 'scores_finaux');
  assert.equal(scores.length, 6);
  const classement = scores[0]?.charge.classement as {
    joueur_id: string;
    a_signe_dernier_voeu: boolean | null;
  }[];
  const ligneJ0 = classement.find((ligne) => ligne.joueur_id === 'J0');
  assert.equal(ligneJ0?.a_signe_dernier_voeu, true, 'révélé ICI, et nulle part avant');
  const ligneJ1 = classement.find((ligne) => ligne.joueur_id === 'J1');
  assert.equal(ligneJ1?.a_signe_dernier_voeu, false);
});
