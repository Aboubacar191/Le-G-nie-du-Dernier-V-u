// ╔════════════════════════════════════════════════════════════════════════╗
// ║  PREUVE MÉCANIQUE DE RG-01 — tests de propriété sur la projection.     ║
// ║  (ARCHI seuils_qualite.interdits_mecaniques, reformulé par ADR-TL-18)  ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Pour chaque schéma EvtXxx, pour chaque destinataire possible, la sortie de
// projeterEvenement satisfait TROIS propriétés, et non une :
//
//  (P-a) CLÔTURE — toute clé présente dans la sortie est déclarée dans le
//        schéma de l'événement ; aucune clé surnuméraire, jamais.
//  (P-b) APPARTENANCE — pour toute clé dont le couple (entite, champ) figure
//        dans registre_champs_secrets, la VALEUR émise appartient au
//        destinataire, ou le destinataire relève de la classe x-visibilite
//        déclarée par l'événement pour cette donnée.
//  (P-c) ÉGALITÉ EXACTE DE L'ENSEMBLE DES CLÉS — ajouté en ARCHI 1.2.0. Exigé
//        « en test de propriété (fast-check) sur états générés, en même temps
//        que P-a et P-b ». C'est ICI qu'il est dû : la porte verifier:uniformite
//        en est le filet sur des scénarios fixés, pas le substitut.
//
// Ici, la campagne par TIRAGE : des parties entières générées par fast-check et
// jouées à travers le moteur réel. La campagne EXHAUSTIVE sur les 30 types
// d'événement est dans exhaustivite-evenements.test.ts.

import test from 'node:test';
import assert from 'node:assert/strict';

import fc from 'fast-check';

import {
  EMISSION_PAR_EVENEMENT,
  TYPES_EVENEMENT,
  VISIBILITE_PAR_EVENEMENT,
  estCodeErreurDeProtocole,
} from '@gdv/partage';
import { projeterEvenement } from '@gdv/moteur';

import { jouer, planPartie } from './scenario-genere.ts';
import {
  verifierAppartenance,
  verifierCloture,
  verifierClesEmises,
} from './verificateurs.ts';

const NOMBRE_SCENARIOS = 60;
const CLASSES_ADMISES = [
  'tous',
  'proprietaire',
  'enqueteur',
  'porteur_clause_et_faiseur',
  'hote',
];

test('(P-a), (P-b) et (P-c) tiennent sur des parties générées aléatoirement', () => {
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
          const cles = verifierClesEmises(effet.type, charge);
          assert.equal(cles, null, cles ?? '');
        }
      }
      return true;
    }),
    { numRuns: NOMBRE_SCENARIOS },
  );
});

/**
 * RUP-02 — le CŒUR de la rupture, éprouvé sur états générés : pour tout effet et
 * pour tout joueur de la session, une trame part. Ce qui varie est la CHARGE,
 * jamais la présence.
 *
 * Les deux seules exemptions sont celles de la liste FERMÉE du contrat, et le
 * test ne les présume pas : il les lit dans x-emission et dans la liste des cinq
 * codes de protocole. Une troisième exemption glissée dans le code ferait échouer
 * ce test, et c'est tout son objet — « une liste à maintenir est une liste qui
 * oublie ».
 */
test('(RUP-02) tout effet non exempté produit une trame pour CHAQUE joueur', () => {
  fc.assert(
    fc.property(planPartie, (plan) => {
      const table = jouer(plan);
      for (const { etat, effet } of table.emissions) {
        if (EMISSION_PAR_EVENEMENT[effet.type] === 'exempte') continue;
        if (effet.type === 'erreur' && estCodeErreurDeProtocole(effet.code)) continue;
        const charges = etat.joueurs.map((joueur) => projeterEvenement(etat, effet, joueur.id));
        const muets = charges.filter((charge) => charge === null).length;
        // Tout ou rien : un effet inapplicable à l'état n'est projeté pour
        // PERSONNE, ce qui laisse le dénombrement égal entre les N joueurs. Un
        // effet projeté pour certains seulement est le canal de ANO-01.
        assert.ok(
          muets === 0 || muets === charges.length,
          `${effet.type} : ${String(muets)} joueur(s) sur ${String(charges.length)} ne ` +
            `reçoivent rien. L'ABSENCE de trame est l'information que RG-80 ferme.`,
        );
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
