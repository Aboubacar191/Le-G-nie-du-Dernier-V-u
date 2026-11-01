// ANO-04, BLOQUANTE — la clause GÉNÉRALE de RG-23, et la garde du gabarit
// COMPARAISON.
//
// MESURE QUI L'IMPOSE (qa/rapports/sonde-fuite-comparaison.txt) : 6 joueurs,
// tous déclarent 4, seul J5 ment en payant 1. La révélation COMPARAISON
// [J0, J5] était émise et diffusée aux six. Comme toutes les déclarations
// valent 4 :
//
//     payé(J5) < payé(J0) <= déclaré(J0) = 4 = déclaré(J5)   (RG-09 borne le
//     paiement par la déclaration : payer plus que déclaré est refusé)
//
// donc payé(J5) < déclaré(J5), donc J5 a menti, avec CERTITUDE, pour n'importe
// quel observateur. Le génie venait de nommer un menteur — troisième loi
// défaite — et les CINQ candidats COMPARAISON de la manche le nommaient.
//
// DEUX MANQUEMENTS, deux correctifs, et ils sont distincts :
//
//   (1) suspects_restants était journalisé à 6 alors que le statut de J5 EST
//       déterminé par la seule information publique. Le calcul de RG-23
//       n'implémentait que la liste FERMÉE qui suit la définition — exonération,
//       accusation MENTEUR, accusation HONNETE — et ignorait la clause GÉNÉRALE
//       qui la précède : « joueurs dont le statut d'honnêteté sur la manche
//       courante n'est pas déterminé par la seule information publique ».
//
//   (2) la garde du moteur ne se déclenchait que pour |suspects| == 2 exactement,
//       si bien qu'à 6 suspects les cinq candidats passaient.
//
// La condition de fuite de COMPARAISON est caractérisable SANS énumération des
// répartitions compatibles : si déclaré(a) <= déclaré(b), alors « a a payé plus
// que b » détermine que b a menti. C'est décidable, c'est exact, et c'est
// strictement plus prudent que la formalisation par la paire {a, b} de la SPEC,
// qui reste appliquée par ailleurs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles, suspectsApresEmission, suspectsPublics } from '@gdv/moteur';
import type { EtatSession, Manche, RevelationEmise } from '@gdv/moteur';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

/** Le scénario EXACT de la sonde : six déclarations à 4, J5 paie 1. */
function tableDeLaSonde(): Table {
  const table = tableEnDeclaration({ joueurs: 6, graine: 'ano-04' });
  table.declarerEtPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 1],
  ]);
  return table;
}

function comparaisons(etat: EtatSession, manche: Manche): readonly { cibles: readonly string[] }[] {
  return candidatsEligibles(etat, manche).filter(
    (candidat) => candidat.gabarit === 'COMPARAISON',
  );
}

const declareDe = (manche: Manche, joueurId: string): number =>
  manche.contributions.find((c) => c.joueur_id === joueurId)?.montant_declare ?? 0;

test('ANO-04 : aucun candidat COMPARAISON ne désigne un menteur par inférence', () => {
  const table = tableDeLaSonde();
  const manche = table.manche(1);

  // La mesure de recette de la sonde : « candidats COMPARAISON qui désignent un
  // menteur » doit rendre 0. Ici les cinq paires [Ji, J5] sont écartées, et il
  // n'en reste aucune : toutes les déclarations étant égales, toute comparaison
  // vraie nomme un menteur.
  assert.deepEqual(
    comparaisons(table.etat, manche).map((candidat) => candidat.cibles),
    [],
    'cinq paires fuyantes J0>J5 … J4>J5 étaient produites',
  );
});

test('ANO-04 : la garde ne désarme pas COMPARAISON quand l’inférence est impossible', () => {
  // Déclarations INÉGALES : J0 déclare 6 et paie 5, J1 déclare 2 et paie 2.
  // « J0 a payé plus que J1 » donne payé(J1) < 5, ce qui n'apprend rien sur
  // payé(J1) < déclaré(J1) = 2. Le gabarit reste donc éligible — une garde qui
  // écarterait ce cas aurait supprimé le gabarit au lieu de le corriger.
  const table = tableEnDeclaration({ joueurs: 6, graine: 'ano-04-licite' });
  table.declarerEtPayer([
    [6, 5],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
  ]);
  const manche = table.manche(1);
  const paires = comparaisons(table.etat, manche);
  assert.ok(paires.length > 0, 'le gabarit doit rester utilisable');
  for (const paire of paires) {
    const [a, b] = paire.cibles as [string, string];
    assert.ok(
      declareDe(manche, a) > declareDe(manche, b),
      `la paire ${a}>${b} détermine que ${b} a menti : déclaré(${a}) <= déclaré(${b})`,
    );
  }
});

test('ANO-04 : la clause GÉNÉRALE de RG-23 retire le joueur déterminé par le public', () => {
  const table = tableDeLaSonde();
  const manche = table.manche(1);
  assert.equal(suspectsPublics(table.etat, manche).length, 6, 'avant toute émission');

  // Une COMPARAISON [J0, J5] déjà émise sur la manche — fixture : le moteur
  // corrigé ne la produit plus, mais le calcul des suspects doit rester juste
  // face à l'historique, et c'est la DÉFENSE EN PROFONDEUR de la garde.
  const emise: RevelationEmise = {
    id: 'rev-ano-04',
    gabarit: 'COMPARAISON',
    variante_formulation: 0,
    cibles: ['J0', 'J5'],
    valeurs: {},
    suspects_restants_apres: 6,
    verifiee_vraie: true,
    emise_at: 0,
  };
  const avecRevelation: Manche = { ...manche, revelations: [emise] };

  assert.deepEqual(
    suspectsPublics(table.etat, avecRevelation),
    ['J0', 'J1', 'J2', 'J3', 'J4'],
    'J5 est démasqué par le seul public : il n’est plus un SUSPECT, il est un fait',
  );
  assert.equal(
    suspectsApresEmission(table.etat, avecRevelation, []),
    5,
    'suspects_restants journalisé à 6 était la mesure (2) de ANO-04',
  );
});

test('ANO-04 : RG-21 continue de bloquer sous deux suspects', () => {
  // À deux joueurs, une COMPARAISON laisserait au mieux un seul suspect : la
  // loi 2 du génie l'interdit, indépendamment de toute inférence.
  const duo = tableEnDeclaration({ joueurs: 2, config: { joueurs_min: 2 } });
  duo.declarerEtPayer([
    [4, 4],
    [2, 1],
  ]);
  assert.deepEqual(comparaisons(duo.etat, duo.manche(1)), []);
});
