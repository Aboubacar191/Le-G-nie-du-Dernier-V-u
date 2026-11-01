// CA-10 — US-06. LE critère du jeu.
//
// Étant donné un joueur ayant déclaré 4 et payé 1, quand on inspecte TOUS les
// messages reçus par les 5 autres joueurs jusqu'à la fin de la manche, alors la
// valeur 1 n'apparaît dans AUCUN d'eux, sous aucune forme ni aucun nom de champ.
//
// PRÉCISION DE MÉTHODE, assumée et consignée : le balayage par VALEUR est fait
// avec un montant payé de 7 et non de 1. La raison est que 1 est aussi un
// numéro de manche, un compteur de déclarations et un index de variante : un
// balayage brut de la valeur 1 échoue sur « manche_courante: 1 », qui n'est pas
// une fuite. Le montant 7 ne peut apparaître dans ce scénario QUE par fuite, ce
// qui rend le test décidable — et strictement plus sévère, puisqu'il cherche la
// valeur à toute profondeur et sous n'importe quel nom de champ.
// Le scénario littéral de la SPEC (déclaré 4, payé 1) est conservé dans les deux
// tests suivants, au niveau des noms de champs et des types de message.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

const SECRET_DISTINCTIF = 7;

/** Toutes les valeurs numériques d'une structure, à toute profondeur. */
function valeursNumeriques(valeur: unknown, trouvees: number[] = []): number[] {
  if (typeof valeur === 'number') trouvees.push(valeur);
  else if (Array.isArray(valeur)) for (const element of valeur) valeursNumeriques(element, trouvees);
  else if (valeur !== null && typeof valeur === 'object') {
    for (const sous of Object.values(valeur)) valeursNumeriques(sous, trouvees);
  }
  return trouvees;
}

/** Toutes les clés d'une structure, à toute profondeur. */
function cles(valeur: unknown, trouvees: string[] = []): string[] {
  if (Array.isArray(valeur)) for (const element of valeur) cles(element, trouvees);
  else if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, sous] of Object.entries(valeur)) {
      trouvees.push(cle);
      cles(sous, trouvees);
    }
  }
  return trouvees;
}

test('CA-10 : le montant payé de J0 ne sort vers aucun autre joueur, à aucune profondeur', () => {
  const table = tableEnDeclaration({ joueurs: 6 });

  table.exiger('J0', 'declarer_contribution', { montant: 9 });
  for (const joueur of table.joueurs.slice(1)) {
    table.exiger(joueur, 'declarer_contribution', { montant: 6 });
  }
  table.exiger('J0', 'payer_secret', { montant: SECRET_DISTINCTIF });
  for (const joueur of table.joueurs.slice(1)) {
    table.exiger(joueur, 'payer_secret', { montant: 6 });
  }

  // Jusqu'à la fin de la manche : révélation, enquêtes, exécution, clôture.
  table.allerA('EXECUTION');
  table.expirer();

  for (const joueur of table.joueurs.slice(1)) {
    for (const trame of table.tramesDe(joueur)) {
      assert.ok(
        !valeursNumeriques(trame.charge).includes(SECRET_DISTINCTIF),
        `la valeur ${SECRET_DISTINCTIF} apparaît dans une trame ${trame.type} reçue par ` +
          `${joueur} : ${JSON.stringify(trame.charge)}`,
      );
    }
  }
});

test('CA-10 : aucune trame reçue par un autre joueur ne porte un champ de paiement', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 4 });
  table.exiger('J0', 'payer_secret', { montant: 1 });
  table.allerA('EXECUTION');
  table.expirer();

  const INTERDITS = ['montant_paye', 'paye_at', 'ampleur_mensonge', 'porteur_clause_joueur_id'];
  for (const joueur of table.joueurs.slice(1)) {
    for (const trame of table.tramesDe(joueur)) {
      for (const interdit of INTERDITS) {
        assert.ok(
          !cles(trame.charge).includes(interdit),
          `le champ ${interdit} apparaît dans ${trame.type} reçu par ${joueur}`,
        );
      }
    }
  }
});

test('CA-10 : le payeur lui-même ne reçoit aucun montant dans paiement_enregistre', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 4 });
  table.exiger('J0', 'payer_secret', { montant: 1 });

  const accuses = table.tramesDe('J0', 'paiement_enregistre');
  assert.equal(accuses.length, 1);
  assert.deepEqual(Object.keys(accuses[0]?.charge ?? {}).sort(), ['enregistre', 'numero_manche']);
});

/**
 * RUP-02 — le critère est RENFORCÉ, pas affaibli.
 *
 * Auparavant : « aucun autre joueur ne reçoit paiement_enregistre ». C'était
 * vrai du CONTENU et FAUX de la forme — la trame n'était émise qu'au payeur,
 * donc son existence même disait QUI avait payé. CONF-12 avait explicitement
 * refusé toute pastille publique « a payé », au motif que « savoir QUI a déjà
 * payé renseignerait sur le comportement de la table » ; la présence de la trame
 * reconstituait ce compteur à l'insu de cet arbitrage.
 *
 * Désormais : les six joueurs reçoivent la trame, et seuls le numéro de manche —
 * donnée publique — en sort pour les cinq autres. Ce qui est vérifié n'est plus
 * l'absence de trame mais l'absence de toute clé non neutre, numéro de manche
 * excepté.
 */
test('CA-10 : aucun autre joueur n’apprend qu’un paiement a eu lieu', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 4 });
  table.exiger('J0', 'payer_secret', { montant: 1 });

  for (const joueur of table.joueurs.slice(1)) {
    assert.equal(
      table.tramesPleinesDe(joueur, 'paiement_enregistre').length,
      0,
      'aucune trame PORTEUSE : le voisin n’apprend pas qu’un paiement a eu lieu',
    );
    for (const trame of table.tramesDe(joueur, 'paiement_enregistre')) {
      assert.deepEqual(
        Object.keys(trame.charge),
        ['numero_manche'],
        'la charge neutre de EvtPaiementEnregistre est {numero_manche}, et rien d’autre',
      );
    }
  }
  // Le DÉNOMBREMENT est égal : c'est la dimension que l'audit a mesurée en fuite.
  const comptes = table.joueurs.map(
    (joueur) => table.tramesDe(joueur, 'paiement_enregistre').length,
  );
  assert.equal(new Set(comptes).size, 1, `dénombrement non uniforme : ${comptes.join(', ')}`);
});
