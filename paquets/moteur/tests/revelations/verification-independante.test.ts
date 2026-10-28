// LOI 1 DU GÉNIE — la revérification est faite par une fonction DISTINCTE.
//
// « Un vérificateur qui réutilise le code du sélecteur ne vérifie rien. »
// (ARCHI invariants_testes_obligatoires, et la mission du nœud S4.)
//
// Deux tests mécaniques ici :
//   · l'INDÉPENDANCE : verification.ts n'importe ni eligibilite.ts, ni
//     selection.ts, ni suspects.ts, ni les accesseurs de l'état ;
//   · la JUSTESSE : chaque gabarit est vérifié VRAI quand il l'est, et FAUX
//     quand il ne l'est pas — y compris sur les énoncés mal formés.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierEnonce } from '@gdv/moteur';

import { Table, tableEnDeclaration } from '../aide/table.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE_VERIFICATION = resolve(ICI, '..', '..', 'src', 'revelations', 'verification.ts');

test('verification.ts ne partage AUCUN code avec le sélecteur', () => {
  const contenu = readFileSync(SOURCE_VERIFICATION, 'utf8');
  const imports = [...contenu.matchAll(/from\s+'([^']+)'/g)].map((trouve) => trouve[1]);
  const INTERDITS = ['./eligibilite.ts', './selection.ts', './suspects.ts', '../etat/acces.ts'];
  for (const interdit of INTERDITS) {
    assert.ok(
      !imports.includes(interdit),
      `verification.ts importe ${interdit} : il répéterait le sélecteur au lieu de le vérifier`,
    );
  }
  // Il n'importe que des TYPES : aucune logique partagée n'est possible.
  assert.deepEqual(
    imports.filter((specificateur) => specificateur !== '@gdv/partage' && specificateur !== './types.ts'),
    ['../etat/types.ts'],
  );
});

/** Une manche où J0 et J1 ont menti, J2..J5 sont honnêtes. */
function mancheDeReference(): Table {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [5, 2], // J0 : ampleur 3
    [4, 0], // J1 : ampleur 4
    [3, 3],
    [3, 3],
    [2, 2],
    [1, 1],
  ]);
  return table;
}

test('ECART_TOTAL : vrai sur les bonnes valeurs, faux sur les mauvaises', () => {
  const table = mancheDeReference();
  const manche = table.manche(1);
  const total_declare = 18;
  const total_paye = 11;
  assert.equal(manche.total_declare, total_declare);
  assert.equal(manche.total_paye, total_paye);

  assert.equal(
    verifierEnonce(table.etat, manche, {
      gabarit: 'ECART_TOTAL',
      cibles: [],
      valeurs: { total_declare, total_paye },
    }),
    true,
  );
  assert.equal(
    verifierEnonce(table.etat, manche, {
      gabarit: 'ECART_TOTAL',
      cibles: [],
      valeurs: { total_declare, total_paye: total_paye + 1 },
    }),
    false,
  );
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'ECART_TOTAL', cibles: [], valeurs: {} }),
    false,
  );
});

test('COMPTAGE : vrai sur le bon k, faux sinon, faux si k n’est pas un nombre', () => {
  const table = mancheDeReference();
  const manche = table.manche(1);
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: { k: 2 } }),
    true,
  );
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: { k: 3 } }),
    false,
  );
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: {} }),
    false,
    'un énoncé sans valeur n’est pas vrai : il est mal formé',
  );
});

test('VOISINAGE : vrai si un voisin cyclique a menti, faux sinon', () => {
  const table = mancheDeReference();
  const manche = table.manche(1);
  // Cercle J0..J5. Menteurs : J0 et J1.
  const vrai = (cible: string): boolean =>
    verifierEnonce(table.etat, manche, { gabarit: 'VOISINAGE', cibles: [cible], valeurs: {} });

  assert.equal(vrai('J5'), true, 'J0 est son voisin cyclique');
  assert.equal(vrai('J1'), true, 'J0 est son voisin');
  assert.equal(vrai('J2'), true, 'J1 est son voisin');
  assert.equal(vrai('J3'), false, 'J2 et J4 sont honnêtes');
  assert.equal(vrai('J4'), false);
  assert.equal(vrai('INCONNU'), false, 'cible hors session');
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'VOISINAGE', cibles: [], valeurs: {} }),
    false,
    'énoncé sans cible',
  );
});

test('VOISINAGE : faux quand l’ordre du cercle n’est pas encore saisi', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // On efface les positions : avant PLACEMENT, aucun voisinage n'existe.
  table.etat = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) => ({ ...joueur, position_cercle: null })),
  };
  assert.equal(
    verifierEnonce(table.etat, table.manche(1), {
      gabarit: 'VOISINAGE',
      cibles: ['J0'],
      valeurs: {},
    }),
    false,
  );
});

test('EXONERATION : vrai pour un honnête, faux pour un menteur', () => {
  const table = mancheDeReference();
  const manche = table.manche(1);
  const vrai = (cible: string): boolean =>
    verifierEnonce(table.etat, manche, { gabarit: 'EXONERATION', cibles: [cible], valeurs: {} });

  assert.equal(vrai('J2'), true);
  assert.equal(vrai('J0'), false, 'J0 a menti : l’exonérer serait faux');
  assert.equal(vrai('INCONNU'), false);
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'EXONERATION', cibles: [], valeurs: {} }),
    false,
  );
});

test('COMPARAISON : vrai sur une inégalité STRICTE, faux à l’égalité', () => {
  const table = mancheDeReference();
  const manche = table.manche(1);
  const vrai = (a: string, b: string): boolean =>
    verifierEnonce(table.etat, manche, { gabarit: 'COMPARAISON', cibles: [a, b], valeurs: {} });

  assert.equal(vrai('J2', 'J1'), true, '3 > 0');
  assert.equal(vrai('J1', 'J2'), false, '0 > 3 est faux');
  assert.equal(vrai('J2', 'J3'), false, '3 > 3 est faux : l’inégalité est stricte');
  assert.equal(vrai('J2', 'J2'), false, 'a === b est mal formé');
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPARAISON', cibles: ['J2'], valeurs: {} }),
    false,
    'une seule cible : mal formé',
  );
});

test('PASSE : vrai s’il existe un menteur à CHAQUE manche, faux sinon', () => {
  const table = new Table({ joueurs: 6, graine: 'passe' }).demarrer();
  // Manche 1 : J0 ment. Manche 2 : J0 ment encore.
  for (let manche = 1; manche <= 2; manche += 1) {
    table.allerA('DECLARATION_PAIEMENT');
    table.exiger('J0', 'declarer_contribution', { montant: 2 });
    table.exiger('J0', 'payer_secret', { montant: 0 });
    for (const joueur of table.joueurs.slice(1)) {
      table.exiger(joueur, 'declarer_contribution', { montant: 2 });
      table.exiger(joueur, 'payer_secret', { montant: 2 });
    }
    table.allerA('EXECUTION');
    table.expirer();
  }
  assert.equal(
    verifierEnonce(table.etat, table.manche(2), { gabarit: 'PASSE', cibles: [], valeurs: {} }),
    true,
  );

  // Manche 3 : J0 est honnête. Plus personne n'a menti à TOUTES les manches.
  table.allerA('DECLARATION_PAIEMENT');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'declarer_contribution', { montant: 2 });
    table.exiger(joueur, 'payer_secret', { montant: 2 });
  }
  assert.equal(
    verifierEnonce(table.etat, table.manche(3), { gabarit: 'PASSE', cibles: [], valeurs: {} }),
    false,
  );
});

test('PASSE : faux quand aucune manche n’existe encore', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  const manche = { ...table.manche(1), numero: 0 };
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'PASSE', cibles: [], valeurs: {} }),
    false,
  );
});

test('la revérification lit les contributions BRUTES, non soumises comprises', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // Personne n'a rien soumis : tout vaut 0, donc personne n'a menti (RG-32).
  const manche = table.manche(1);
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: { k: 0 } }),
    true,
  );
  assert.equal(
    verifierEnonce(table.etat, manche, {
      gabarit: 'ECART_TOTAL',
      cibles: [],
      valeurs: { total_declare: 0, total_paye: 0 },
    }),
    true,
  );
});
