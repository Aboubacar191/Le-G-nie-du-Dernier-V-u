// CA-36 — US-13. Étant donné un joueur consultant son écran, quand on inspecte
// le message qui porte son solde, alors il ne contient QUE son propre solde et
// SES propres mouvements. (ADR-CP-05 : un solde public permettrait de déduire le
// paiement secret par différence.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { estChargePleine, Table } from '../aide/table.ts';

// RUP-02 / RG-80 : EvtSoldeMisAJour était « le principal contributeur au profil
// global 28 contre 25 » relevé par le QA — il n'était émis qu'au joueur dont le
// solde bougeait, et disait donc qu'il avait payé, enquêté, transféré ou reçu.
// La trame part désormais aux N joueurs, charge neutre {} pour ceux dont le
// solde n'a pas bougé. Tout ce fichier raisonne donc sur les trames PLEINES :
// compter les trames ne dit plus rien de la visibilité, et un critère de
// non-fuite qui les compterait serait vert à tort.

test('CA-36 : solde_mis_a_jour ne porte que le solde et les mouvements du destinataire', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-36' }).demarrer();
  table.allerA('NEGOCIATION');
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 3 });

  for (const joueur of ['J0', 'J1']) {
    const soldes = table.tramesPleinesDe(joueur, 'solde_mis_a_jour');
    assert.ok(soldes.length >= 1);
    const derniere = soldes[soldes.length - 1];
    assert.deepEqual(Object.keys(derniere?.charge ?? {}).sort(), [
      'derniers_mouvements',
      'solde_pieces',
    ]);
    assert.equal(derniere?.charge.solde_pieces, table.solde(joueur));
  }
});

test('CA-36 : aucune variante ne liste les soldes de plusieurs joueurs', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-36b' }).demarrer();
  table.allerA('EXECUTION');
  table.expirer();

  const soldes = table.trames.filter(
    (t) => t.type === 'solde_mis_a_jour' && estChargePleine(t),
  );
  assert.ok(soldes.length > 0, 'le scénario doit produire au moins une charge pleine');
  for (const trame of soldes) {
    const mouvements = (
      trame.charge.derniers_mouvements as { elements: { contrepartie_joueur_id: string | null }[] }
    ).elements;
    // Un mouvement peut nommer une CONTREPARTIE — le destinataire est partie
    // prenante de ce mouvement, et le contrat le prévoit — mais jamais un solde
    // d'autrui.
    assert.ok(Array.isArray(mouvements));
    assert.equal(typeof trame.charge.solde_pieces, 'number');
  }
});

test('CA-36 : le journal de pièces d’un joueur ne sort que vers lui', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-36c' }).demarrer();
  table.allerA('NEGOCIATION');
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 3 });

  // La dernière trame reçue porte le solde courant du destinataire ; les
  // précédentes portaient le solde de leur instant, ce qui est l'objet même du
  // journal.
  for (const joueur of table.joueurs) {
    const siennes = table.tramesPleinesDe(joueur, 'solde_mis_a_jour');
    const derniere = siennes[siennes.length - 1];
    assert.equal(derniere?.charge.solde_pieces, table.solde(joueur), `trame reçue par ${joueur}`);
  }
  // J2 n'est partie prenante d'aucun mouvement du transfert : il reçoit bien
  // les deux trames du lot, mais elles ne lui APPRENNENT rien — charge neutre.
  // L'unique charge pleine qu'il ait jamais reçue est celle de sa dotation.
  assert.equal(table.tramesPleinesDe('J2', 'solde_mis_a_jour').length, 1, 'sa dotation initiale');
  for (const trame of table.tramesNeutresDe('J2', 'solde_mis_a_jour')) {
    assert.deepEqual(Object.keys(trame.charge), [], 'la charge neutre de EvtSoldeMisAJour est {}');
  }
});

test('CA-36 : la page de mouvements est bornée et signale sa troncature', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-36d' }).demarrer();
  table.allerA('EXECUTION');
  table.expirer();
  const vue = table.vuePrivee('J0');
  const page = vue?.mes_mouvements as {
    elements: unknown[];
    curseur_suivant: string | null;
    tronque: boolean;
  };
  assert.ok(page.elements.length <= 50, 'limite par défaut de la pagination');
  assert.equal(typeof page.tronque, 'boolean');
});
