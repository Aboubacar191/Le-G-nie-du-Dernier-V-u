// CA-12 — US-07. Étant donné une manche dont la clause est tirée et un joueur de
// rôle Faiseur de contrats, quand la phase VOEU s'ouvre, alors la clause est
// reçue par le porteur et par le Faiseur de contrats, et par PERSONNE D'AUTRE.
// (RG-18)

import test from 'node:test';
import assert from 'node:assert/strict';

import { estChargePleine, Table } from '../aide/table.ts';

test('CA-12 : seuls le porteur et les FAISEUR_CONTRATS reçoivent la clause', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-12' }).demarrer();
  const manche = table.manche(1);
  const porteur = manche.porteur_clause_joueur_id;
  const faiseurs = table.etat.joueurs
    .filter((joueur) => joueur.role_secret === 'FAISEUR_CONTRATS')
    .map((joueur) => joueur.id);
  const autorises = new Set([porteur, ...faiseurs]);
  assert.ok(faiseurs.length >= 1, 'les 4 rôles sont présents, donc au moins un faiseur');

  // RUP-02 : la trame part aux SIX joueurs — ANO-01 a été mesurée précisément
  // sur ce dénombrement, {J0:0, J1:0, J2:0, J3:1, J4:0, J5:1}, qui livrait
  // l'ensemble « porteur ∪ FAISEUR_CONTRATS » sans qu'aucun champ ne fuite.
  // Ce qui reste restreint est la charge PORTEUSE : elle ne va qu'aux autorisés.
  const recues = table.trames.filter((trame) => trame.type === 'clause_recue');
  assert.deepEqual(
    [...new Set(recues.map((trame) => trame.destinataire))].sort(),
    [...table.joueurs].sort(),
    'toute trame part à tous : un destinataire de moins est une trame de moins',
  );
  const porteuses = recues.filter(estChargePleine);
  assert.deepEqual(
    [...new Set(porteuses.map((trame) => trame.destinataire))].sort(),
    [...autorises].sort(),
  );
  for (const trame of porteuses) {
    assert.equal(trame.charge.clause, manche.clause_cle);
    assert.equal(trame.charge.numero_manche, 1);
  }
  for (const trame of recues.filter((candidate) => !estChargePleine(candidate))) {
    assert.deepEqual(
      Object.keys(trame.charge),
      ['numero_manche'],
      'la charge neutre de EvtClauseRecue est {numero_manche}, et rien d’autre',
    );
    assert.ok(!autorises.has(trame.destinataire));
  }
});

test('CA-12 : je_suis_porteur parle du destinataire, et ne désigne jamais un autre', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-12' }).demarrer();
  const porteur = table.manche(1).porteur_clause_joueur_id;

  for (const trame of table.trames.filter((t) => t.type === 'clause_recue' && estChargePleine(t))) {
    assert.equal(trame.charge.je_suis_porteur, trame.destinataire === porteur);
    // Aucun identifiant de joueur ne figure dans la charge : l'identité du
    // porteur n'est révélée à personne, jamais, en v1.
    assert.deepEqual(Object.keys(trame.charge).sort(), [
      'clause',
      'je_suis_porteur',
      'numero_manche',
    ]);
  }
});

test('CA-12 : l’identité du porteur ne sort dans AUCUNE trame de toute la manche', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-12' }).demarrer();
  const porteur = table.manche(1).porteur_clause_joueur_id;
  table.allerA('EXECUTION');
  table.expirer();

  // L'identifiant du porteur circule légitimement (déclarations, accusations,
  // ordre du cercle) ; ce qui ne doit jamais sortir, c'est un champ qui le
  // DÉSIGNE comme porteur. Les trois noms que la porte de visibilité surveille
  // sont porteur_clause_joueur_id, porteur_joueur_id et porteur
  // (outils/visibilite/cartographie.mjs). je_suis_porteur est l'exception
  // déclarée : il parle du destinataire et de personne d'autre.
  const INTERDITS = ['porteur_clause_joueur_id', 'porteur_joueur_id', 'porteur'];
  function clesProfondes(valeur: unknown, trouvees: string[] = []): string[] {
    if (Array.isArray(valeur)) for (const element of valeur) clesProfondes(element, trouvees);
    else if (valeur !== null && typeof valeur === 'object') {
      for (const [cle, sous] of Object.entries(valeur)) {
        trouvees.push(cle);
        clesProfondes(sous, trouvees);
      }
    }
    return trouvees;
  }

  for (const trame of table.trames) {
    for (const cle of clesProfondes(trame.charge)) {
      assert.ok(
        !INTERDITS.includes(cle),
        `${trame.type} porte le champ ${cle}, qui désigne le porteur de clause`,
      );
    }
  }
  assert.ok(porteur.length > 0);
});
