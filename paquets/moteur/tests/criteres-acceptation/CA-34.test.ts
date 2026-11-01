// CA-34 — US-12. RÉÉCRIT : RG-29 a été MODIFIÉE par la SPEC 1.4.1, qui invalide
// nommément l'ancien énoncé de ce critère (« invalide : CA-34, réécrit en
// conséquence »).
//
// AVANT — « 6 pièces sont prélevées sur l'emprunteur, PLAFONNÉES À SON SOLDE, le
// reliquat restant dû ». Mesuré en fuite par le QA (ANO-07, majeure) : dès que
// le reliquat dû était non nul, le montant prélevé ÉTAIT, par construction, le
// solde EXACT de l'emprunteur — prélevé 3, solde réel 3. Le prélèvement partiel
// était donc un oracle de solde, et le prêteur en voyait le montant dans son
// propre journal de pièces, que RG-42 rend non supprimable.
//
// APRÈS — TOUT OU RIEN. « Si le solde de l'emprunteur couvre la somme due, elle
// est prélevée intégralement ; sinon rien n'est prélevé et la dette est reportée
// ENTIÈRE à l'exécution suivante. AUCUN PRÉLÈVEMENT PARTIEL. Le prêteur
// n'apprend qu'un booléen : remboursé, ou reporté. » (RG-29)
//
// Ce qui subsiste, et qui est DÉCLARÉ : le booléen. Un remboursement automatique
// apprend nécessairement « le solde couvrait, ou non » ; c'est une inégalité d'un
// seul bit au lieu d'un montant exact, et elle est inhérente à la mécanique.

import test from 'node:test';
import assert from 'node:assert/strict';

import { plafond, unPlus, verifierInvariants } from '@gdv/moteur';

import { estChargePleine, Table } from '../aide/table.ts';

/** Traverse une manche sans qu'aucun joueur n'agisse : tout vaut 0 (RG-32). */
function traverserUneManche(table: Table): void {
  table.allerA('EXECUTION');
  table.expirer();
}

function tableAvecPretALaManche2(graine = 'ca-34'): Table {
  const table = new Table({ joueurs: 6, graine }).demarrer();
  table.imposerRole('J0', 'PRETEUR');
  traverserUneManche(table); // manche 1

  table.allerA('NEGOCIATION');
  assert.equal(table.etat.manche_courante, 2);
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
  const pretId = table.etat.prets[0]?.id ?? '';
  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: true });
  return table;
}

test('CA-34 : le du_total vaut plafond(principal × (1 + taux)) = 6', () => {
  const table = tableAvecPretALaManche2();
  const pret = table.etat.prets[0];
  assert.equal(pret?.statut, 'ACTIF');
  assert.equal(pret?.principal, 4);
  assert.equal(pret?.du_total, 6);
  assert.equal(pret?.manche_emission, 2);
  assert.equal(plafond(4, unPlus([1, 2])), 6, 'arithmétique entière, arrondi SUPÉRIEUR');

  assert.equal(table.solde('J0'), 8, '12 − 4 prêtées');
  assert.equal(table.solde('J1'), 16, '12 + 4 reçues');
});

test('CA-34 : rien n’est prélevé à l’exécution de la manche d’ÉMISSION', () => {
  const table = tableAvecPretALaManche2();
  table.allerA('EXECUTION');
  assert.equal(table.etat.prets[0]?.rembourse, 0, 'manche 2 : pas encore échu');
  assert.equal(table.solde('J1'), 16);
});

test('CA-34 : le solde couvre la somme due — les 6 pièces sont prélevées EN ENTIER', () => {
  const table = tableAvecPretALaManche2();
  traverserUneManche(table); // clôture de la manche 2
  table.allerA('EXECUTION'); // manche 3
  assert.equal(table.etat.manche_courante, 3);

  const pret = table.etat.prets[0];
  assert.equal(pret?.rembourse, 6);
  assert.equal(pret?.statut, 'SOLDE');
  assert.equal(table.solde('J1'), 10, '16 − 6');
  assert.equal(table.solde('J0'), 14, '8 + 6');
  assert.ok(verifierInvariants(table.etat).ok);

  // RUP-02 : la trame part aux SIX — sa seule présence disait « un prêt existe »,
  // donc que l'un des deux détient le rôle PRETEUR, qui est secret.
  const preleves = table.trames.filter((trame) => trame.type === 'pret_preleve');
  assert.deepEqual(
    [...new Set(preleves.map((trame) => trame.destinataire))].sort(),
    [...table.joueurs].sort(),
  );

  // Trois variantes NOMMÉES au contrat, et aucune n'est une autre amputée :
  // emprunteur (six clés), prêteur (trois), tiers (aucune).
  const chargeEmprunteur = preleves.find((trame) => trame.destinataire === 'J1')?.charge;
  assert.equal(chargeEmprunteur?.montant_preleve, 6);
  assert.equal(chargeEmprunteur?.reliquat_du, 0);

  const chargePreteur = preleves.find((trame) => trame.destinataire === 'J0')?.charge;
  assert.deepEqual(
    Object.keys(chargePreteur ?? {}).sort(),
    ['numero_manche', 'pret_id', 'statut'],
    'ANO-07 : le prêteur n’apprend qu’un booléen, porté par le statut',
  );
  assert.equal(chargePreteur?.statut, 'SOLDE', 'remboursé');

  // La variante du prêteur n'est PAS la variante complète : estChargePleine, qui
  // compare à l'ensemble des champs déclarés, la classe donc avec les charges
  // neutres. C'est exact et voulu — elle n'est « pleine » pour personne — et
  // c'est pourquoi les tiers sont désignés par leur identité, pas par ce
  // prédicat.
  assert.ok(!estChargePleine(preleves.find((t) => t.destinataire === 'J0') as never));
  for (const trame of preleves.filter((t) => !['J0', 'J1'].includes(t.destinataire))) {
    assert.deepEqual(Object.keys(trame.charge), [], 'charge neutre des tiers : {}');
  }
});

test('CA-34 : le solde ne couvre pas — RIEN n’est prélevé, la dette est reportée ENTIÈRE', () => {
  const table = tableAvecPretALaManche2('ca-34b');

  // L'emprunteur dépense presque tout : il lui restera 2 pièces pour 6 dues.
  table.allerA('DECLARATION_PAIEMENT');
  table.exiger('J1', 'declarer_contribution', { montant: 14 });
  table.exiger('J1', 'payer_secret', { montant: 14 });
  traverserUneManche(table); // clôture de la manche 2

  table.allerA('EXECUTION'); // manche 3
  const pret = table.etat.prets[0];
  assert.equal(table.solde('J1'), 2, 'AUCUN prélèvement partiel : ses 2 pièces restent siennes');
  assert.equal(pret?.rembourse, 0, 'la dette est reportée ENTIÈRE');
  assert.equal(pret?.statut, 'ACTIF');
  assert.ok(verifierInvariants(table.etat).ok);

  // L'ANCIEN comportement prélevait 2 et laissait un reliquat de 4 : le couple
  // (montant_preleve, reliquat_du) = (2, 4) disait alors « solde(J1) == 2 »,
  // avec certitude. Désormais la charge de l'emprunteur ne porte aucun montant
  // prélevé, et le reliquat est la dette entière — qu'il connaît déjà.
  const preleves = table.trames.filter((trame) => trame.type === 'pret_preleve');
  const chargeEmprunteur = preleves.find((trame) => trame.destinataire === 'J1')?.charge;
  assert.equal(chargeEmprunteur?.montant_preleve, 0);
  assert.equal(chargeEmprunteur?.reliquat_du, 6, 'la dette entière, pas un reliquat partiel');

  // RG-80 : la trame est émise MÊME quand rien n'est prélevé. Son absence
  // révélerait, à elle seule, que le solde de l'emprunteur ne couvrait pas la
  // dette — c'est-à-dire exactement le bit que le tout-ou-rien assume, mais
  // livré à toute la table au lieu des deux parties.
  assert.deepEqual(
    [...new Set(preleves.map((trame) => trame.destinataire))].sort(),
    [...table.joueurs].sort(),
  );
  const chargePreteur = preleves.find((trame) => trame.destinataire === 'J0')?.charge;
  assert.equal(chargePreteur?.statut, 'ACTIF', 'reporté — le prêteur n’apprend que ce booléen');
  assert.equal(table.solde('J0'), 8, 'le prêteur n’a RIEN encaissé : aucun mouvement, aucun oracle');
});

test('CA-34 : la dette reportée est prélevée EN ENTIER dès que le solde la couvre', () => {
  const table = tableAvecPretALaManche2('ca-34b');
  table.allerA('DECLARATION_PAIEMENT');
  table.exiger('J1', 'declarer_contribution', { montant: 14 });
  table.exiger('J1', 'payer_secret', { montant: 14 });
  traverserUneManche(table);
  table.allerA('EXECUTION'); // manche 3 : rien prélevé
  assert.equal(table.etat.prets[0]?.rembourse, 0);

  // Un tiers lui transfère de quoi payer : 2 + 4 = 6, soit exactement la dette.
  table.expirer();
  table.allerA('NEGOCIATION');
  table.exiger('J2', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 4 });
  table.allerA('EXECUTION');

  assert.equal(table.etat.prets[0]?.rembourse, 6, 'la dette entière, en un seul prélèvement');
  assert.equal(table.etat.prets[0]?.statut, 'SOLDE');
  assert.equal(table.solde('J1'), 0);
  assert.ok(verifierInvariants(table.etat).ok);
});
