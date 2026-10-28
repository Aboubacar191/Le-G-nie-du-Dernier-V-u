// ╔════════════════════════════════════════════════════════════════════════╗
// ║  PREUVE MÉCANIQUE DE RG-01 — tests de propriété sur la projection.     ║
// ║  (ARCHI seuils_qualite.interdits_mecaniques, reformulé par ADR-TL-18)  ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Pour chaque schéma EvtXxx, pour chaque destinataire possible, la sortie de
// projeterEvenement satisfait DEUX propriétés, et non une :
//
//  (P-a) CLÔTURE — toute clé présente dans la sortie est déclarée dans le
//        schéma de l'événement ; aucune clé surnuméraire, jamais.
//  (P-b) APPARTENANCE — pour toute clé dont le couple (entite, champ) figure
//        dans registre_champs_secrets, la VALEUR émise appartient au
//        destinataire, ou le destinataire relève de la classe x-visibilite
//        déclarée par l'événement pour cette donnée.
//
// Ici, la campagne par TIRAGE : des parties entières générées par fast-check et
// jouées à travers le moteur réel. La campagne EXHAUSTIVE sur les 30 types
// d'événement est dans exhaustivite-evenements.test.ts.

import test from 'node:test';
import assert from 'node:assert/strict';

import fc from 'fast-check';

import { TYPES_EVENEMENT, VISIBILITE_PAR_EVENEMENT } from '@gdv/partage';
import { projeterEvenement } from '@gdv/moteur';

import { jouer, planPartie } from './scenario-genere.ts';
import { verifierAppartenance, verifierCloture } from './verificateurs.ts';

const NOMBRE_SCENARIOS = 60;
const CLASSES_ADMISES = [
  'tous',
  'proprietaire',
  'enqueteur',
  'porteur_clause_et_faiseur',
  'hote',
];

test('(P-a) et (P-b) tiennent sur des parties générées aléatoirement', () => {
  fc.assert(
    fc.property(planPartie, (plan) => {
      const table = jouer(plan);
      for (const { etat, effet } of table.emissions) {
        for (const joueur of etat.joueurs) {
          const charge = projeterEvenement(etat, effet, joueur.id);
          if (charge === null) continue;
          const cloture = verifierCloture(effet.type, charge);
          assert.equal(cloture, null, cloture ?? '');
          const appartenance = verifierAppartenance(etat, effet.type, joueur.id, charge);
          assert.equal(appartenance, null, appartenance ?? '');
        }
      }
      return true;
    }),
    { numRuns: NOMBRE_SCENARIOS },
  );
});

test('(P-a) la projection ne rend RIEN pour un destinataire hors session', () => {
  fc.assert(
    fc.property(planPartie, (plan) => {
      const table = jouer(plan);
      for (const { etat, effet } of table.emissions) {
        assert.equal(projeterEvenement(etat, effet, 'ETRANGER'), null);
      }
      return true;
    }),
    { numRuns: 10 },
  );
});

test('(P-b) les 30 événements du contrat ont une classe de destinataire déclarée', () => {
  assert.equal(TYPES_EVENEMENT.length, 30);
  for (const type of TYPES_EVENEMENT) {
    const classe = VISIBILITE_PAR_EVENEMENT[type];
    assert.ok(CLASSES_ADMISES.includes(classe), `${type} : classe « ${classe} » inconnue`);
  }
});
