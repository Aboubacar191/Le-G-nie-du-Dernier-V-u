// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — charges neutres, RUP-02 / RG-80.              ║
// ║  Couverture exigée sur src/projection : 100 % des lignes ET des        ║
// ║  branches. Ce fichier existe parce qu'une branche y manquait.          ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// src/projection/charges-neutres.ts annonçait ce fichier dans son en-tête ; il
// n'existait pas. Conséquence MESURÉE par npm run couverture : branches de
// moteur/projection à 99,57 % pour un seuil de 100, l'unique branche manquante
// étant la ligne 74 — l'exemption des cinq codes d'erreur de protocole. Une
// branche non exécutée dans la frontière de sécurité est un chemin par lequel
// un secret peut sortir sans qu'aucun test ne l'ait vu : le seuil de 100 % n'est
// pas un chiffre de confort.
//
// La liste des cinq exemptés est FERMÉE par le contrat et lue par
// estCodeErreurDeProtocole. Ce test ne la recopie pas : il la parcourt. Un
// sixième code glissé dans la liste du code sans décision d'architecture
// resterait invisible ici, mais c'est le contrôle U4 de la porte d'uniformité
// qui compare la liste du CODE à celle du CONTRAT — chaque dispositif à sa
// mesure.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODES_ERREUR,
  estCodeErreurDeProtocole,
  type CodeErreur,
} from '@gdv/partage';
import { projeterEvenement, type Effet } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

const erreurDe = (auteur: string, code: CodeErreur): Effet => ({
  type: 'erreur',
  auteur_joueur_id: auteur,
  code,
  message: 'refus',
  id_correlation: 'correlation-de-test',
});

function table(): Table {
  return new Table({ joueurs: 6, graine: 'charges-neutres' }).demarrer();
}

test('les cinq codes de PROTOCOLE n’émettent RIEN vers les autres joueurs', () => {
  const plateau = table();
  const protocole = CODES_ERREUR.filter((code) => estCodeErreurDeProtocole(code));
  assert.equal(protocole.length, 5, 'la liste fermée du contrat compte cinq codes');

  for (const code of protocole) {
    const effet = erreurDe('J0', code);
    assert.deepEqual(
      Object.keys(projeterEvenement(plateau.etat, effet, 'J0') ?? {}).sort(),
      ['code', 'details', 'id_correlation', 'message'],
      `${code} doit parvenir à son auteur`,
    );
    for (const autre of ['J1', 'J5']) {
      assert.equal(
        projeterEvenement(plateau.etat, effet, autre),
        null,
        `${code} : AUCUNE trame ne part vers ${autre}. Ces cinq refus décrivent la ` +
          `TRAME et non un acte de jeu, et TROP_DE_REQUETES émis à tous ferait d’une ` +
          `limitation de débit un amplificateur d’inondation.`,
      );
    }
  }
});

test('tout AUTRE refus part à tous, charge neutre {} pour les N−1', () => {
  const plateau = table();
  const soumis = CODES_ERREUR.filter((code) => !estCodeErreurDeProtocole(code));
  assert.ok(soumis.length > 0);

  for (const code of soumis) {
    const effet = erreurDe('J0', code);
    for (const autre of ['J1', 'J5']) {
      const charge = projeterEvenement(plateau.etat, effet, autre);
      assert.deepEqual(
        Object.keys(charge ?? { manquante: true }),
        [],
        `${code} : la charge neutre de EvtErreur est l’objet VIDE. Sa PRÉSENCE disait ` +
          `« ce joueur a TENTÉ un acte, y compris secret, et a été refusé » — ` +
          `SOLDE_INSUFFISANT sur une enquête en est l’exemple exact.`,
      );
    }
  }
});

test('un destinataire hors session ne reçoit rien, pas même une charge neutre', () => {
  const plateau = table();
  assert.equal(
    projeterEvenement(plateau.etat, erreurDe('J0', 'SOLDE_INSUFFISANT'), 'inconnu'),
    null,
  );
});
