// Accès à l'état et journal de pièces : les chemins d'ÉCHEC.
//
// Une exception dans le moteur est un défaut de programmation, pas un refus
// métier (ARCHI conventions.gestion_erreurs). Ces chemins doivent donc être
// testés — sinon la seule façon de les découvrir est une partie en présentiel.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appliquerMouvement,
  appliquerMouvements,
  contributionDe,
  creerHorlogeFigee,
  declareDe,
  estHote,
  exigerJoueur,
  exigerMancheCourante,
  joueursConnectes,
  mancheCourante,
  manchePar,
  mouvementsDe,
  ordreCercle,
  payeDe,
  transferer,
  trouverJoueur,
  verifierInvariants,
  voisinsDe,
} from '@gdv/moteur';

import { Table, tableEnDeclaration } from '../aide/table.ts';

const ECRITURE = { identifiant: () => 'id-test', maintenant: 1_700_000_000_000 };

test('trouverJoueur rend undefined, exigerJoueur échoue bruyamment', () => {
  const table = new Table({ joueurs: 6 });
  assert.notEqual(trouverJoueur(table.etat, 'J0'), undefined);
  assert.equal(trouverJoueur(table.etat, 'INCONNU'), undefined);
  assert.throws(() => exigerJoueur(table.etat, 'INCONNU'), /Joueur inconnu/);
});

test('mancheCourante rend undefined avant la première manche', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(mancheCourante(table.etat), undefined);
  assert.throws(() => exigerMancheCourante(table.etat), /Aucune manche ouverte/);

  table.demarrer();
  assert.notEqual(mancheCourante(table.etat), undefined);
  assert.equal(exigerMancheCourante(table.etat).numero, 1);
  assert.equal(manchePar(table.etat, 1)?.numero, 1);
  assert.equal(manchePar(table.etat, 99), undefined);
});

test('contributionDe, declareDe et payeDe : une non-soumission vaut 0 (RG-32)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  const manche = table.manche(1);
  assert.equal(contributionDe(manche, 'J0'), undefined);
  assert.equal(declareDe(manche, 'J0'), 0);
  assert.equal(payeDe(manche, 'J0'), 0);

  table.exiger('J0', 'declarer_contribution', { montant: 5 });
  const apres = table.manche(1);
  assert.equal(declareDe(apres, 'J0'), 5);
  assert.equal(payeDe(apres, 'J0'), 0, 'déclaré mais pas encore payé');
});

test('estHote distingue l’hôte, et ignore un identifiant inconnu', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(estHote(table.etat, 'J0'), true);
  assert.equal(estHote(table.etat, 'J1'), false);
  assert.equal(estHote(table.etat, 'INCONNU'), false);
});

test('joueursConnectes ne compte que les connectés', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(joueursConnectes(table.etat).length, 6);
  table.etat = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) =>
      joueur.id === 'J2' ? { ...joueur, connecte: false } : joueur,
    ),
  };
  assert.equal(joueursConnectes(table.etat).length, 5);
});

test('ordreCercle est vide avant le placement, puis trié par position', () => {
  const table = new Table({ joueurs: 6 });
  assert.deepEqual(ordreCercle(table.etat), []);
  assert.deepEqual(voisinsDe(table.etat, 'J0'), [], 'aucun voisinage sans cercle');

  table.demarrer();
  assert.deepEqual(
    ordreCercle(table.etat).map((joueur) => joueur.id),
    ['J0', 'J1', 'J2', 'J3', 'J4', 'J5'],
  );
  assert.deepEqual([...voisinsDe(table.etat, 'J3')].sort(), ['J2', 'J4']);
  assert.deepEqual(voisinsDe(table.etat, 'INCONNU'), [], 'joueur hors cercle');
});

test('voisinsDe : un cercle de 2 a un seul voisin distinct de chaque côté', () => {
  const duo = new Table({ joueurs: 2, config: { joueurs_min: 2 } }).demarrer();
  assert.deepEqual(voisinsDe(duo.etat, 'J0'), ['J1'], 'le même joueur des deux côtés, dédoublonné');
});

test('mouvementsDe ne rend que les mouvements du joueur demandé', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(mouvementsDe(table.etat, 'J0').length, 1);
  assert.equal(mouvementsDe(table.etat, 'INCONNU').length, 0);
});

test('un mouvement de delta NUL est refusé : une ligne sans effet ne prouve rien', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.throws(
    () => appliquerMouvement(table.etat, { joueur_id: 'J0', delta: 0, motif: 'consolation' }, ECRITURE),
    /delta nul/,
  );
});

test('un mouvement qui rendrait le solde NÉGATIF est refusé (RG-41)', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.throws(
    () =>
      appliquerMouvement(
        table.etat,
        { joueur_id: 'J0', delta: -13, motif: 'amende_payee' },
        ECRITURE,
      ),
    /RG-41 violée/,
  );
});

test('appliquerMouvements saute les deltas nuls sans échouer', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const apres = appliquerMouvements(
    table.etat,
    [
      { joueur_id: 'J0', delta: 0, motif: 'consolation' },
      { joueur_id: 'J0', delta: 2, motif: 'consolation' },
      { joueur_id: 'J1', delta: 0, motif: 'consolation' },
    ],
    ECRITURE,
  );
  assert.equal(apres.joueurs.find((joueur) => joueur.id === 'J0')?.solde_pieces, 14);
  assert.equal(apres.mouvements.filter((m) => m.motif === 'consolation').length, 1);
  assert.ok(verifierInvariants(apres).ok);
});

test('transferer d’un montant NUL ne produit aucune ligne', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const apres = transferer(
    table.etat,
    { de: 'J0', vers: 'J1', montant: 0, motif_debit: 'transfert_emis', motif_credit: 'transfert_recu' },
    ECRITURE,
  );
  assert.equal(apres.mouvements.length, table.etat.mouvements.length);
});

test('transferer écrit DEUX lignes symétriques, avec contrepartie', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const apres = transferer(
    table.etat,
    { de: 'J0', vers: 'J1', montant: 3, motif_debit: 'transfert_emis', motif_credit: 'transfert_recu' },
    ECRITURE,
  );
  const nouvelles = apres.mouvements.slice(table.etat.mouvements.length);
  assert.equal(nouvelles.length, 2);
  assert.equal(nouvelles[0]?.delta, -3);
  assert.equal(nouvelles[0]?.contrepartie_joueur_id, 'J1');
  assert.equal(nouvelles[1]?.delta, 3);
  assert.equal(nouvelles[1]?.contrepartie_joueur_id, 'J0');
  assert.ok(verifierInvariants(apres).ok);
});

test('verifierInvariants détecte une incohérence entre solde et journal', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const falsifie = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) =>
      joueur.id === 'J0' ? { ...joueur, solde_pieces: 99 } : joueur,
    ),
  };
  const rapport = verifierInvariants(falsifie);
  assert.equal(rapport.ok, false);
  assert.deepEqual(rapport.solde_incoherent, ['J0']);
  assert.deepEqual(rapport.solde_negatif, []);
});

test('verifierInvariants détecte un solde négatif', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const falsifie = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) =>
      joueur.id === 'J0' ? { ...joueur, solde_pieces: -1 } : joueur,
    ),
  };
  const rapport = verifierInvariants(falsifie);
  assert.equal(rapport.ok, false);
  assert.deepEqual(rapport.solde_negatif, ['J0']);
});

test('creerHorlogeFigee rend toujours le même instant', () => {
  const horloge = creerHorlogeFigee(42);
  assert.equal(horloge.maintenant(), 42);
  assert.equal(horloge.maintenant(), 42);
});
