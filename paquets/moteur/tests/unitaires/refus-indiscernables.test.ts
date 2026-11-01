// REFUS QUI NE RENSEIGNENT PAS — ANO-08 (majeure), ANO-09, ANO-13.
//
// « Un refus adressé à un joueur ne doit renseigner que sur l'état de CE
//   joueur. » C'est la règle générale du moteur, et les témoins de la sonde du
//   QA montrent qu'elle est tenue partout ailleurs : DEJA_SOUMIS,
//   MONTANT_INVALIDE, QUOTA_DEPASSE, CIBLE_INVALIDE ne dépendent que de
//   l'auteur. repondre_pret était la seule exception, et elle en portait deux.
//
// ANO-08, MESURÉE : {code: SOLDE_INSUFFISANT, message: « Le prêteur n'a plus le
// principal disponible. »}. L'emprunteur apprenait que solde(prêteur) <
// principal, et pouvait encadrer ce solde par DICHOTOMIE en faisant varier le
// principal de propositions successives.
//
// ANO-09, MESURÉE : CIBLE_INVALIDE pour un prêt inexistant contre
// USURPATION_IDENTITE pour un prêt existant adressé à autrui — un oracle
// d'existence sur les identifiants de prêt. Atténué par des UUIDv4 non
// devinables, donc classé mineur, mais un modèle de menace ne se tient pas avec
// une atténuation pour seule défense.
//
// ANO-13 : un type de commande inconnu levait une EXCEPTION
// (« GESTIONNAIRES[type] is not a function ») au lieu de rendre une erreur
// typée. Non atteignable depuis le réseau — SchemaEnveloppeCommande le barre en
// amont — mais la défense en profondeur revendiquée par commandes/resultat.ts
// ne couvrait alors que la CHARGE, pas le TYPE.

import test from 'node:test';
import assert from 'node:assert/strict';

import { appliquerCommande, type ResultatCommande } from '@gdv/moteur';
import type { TypeCommande } from '@gdv/partage';

import { Table } from '../aide/table.ts';

const MESSAGE_IMPOSE = 'Ce prêt n’est plus disponible.';

interface Refus {
  readonly code: string;
  readonly message: string;
}

const refusDe = (resultat: { ok: boolean }): Refus =>
  (resultat as unknown as { erreur: Refus }).erreur;

/** Prêteur J0, un prêt PROPOSE de principal 6 à l'emprunteur J1. */
function tableAvecPretPropose(graine = 'ano-08'): { table: Table; pretId: string } {
  const table = new Table({ joueurs: 6, graine }).demarrer().allerA('NEGOCIATION');
  table.imposerRole('J0', 'PRETEUR');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 6 });
  return { table, pretId: table.etat.prets[0]?.id ?? '' };
}

test('ANO-08 : le prêteur appauvri ne fait plus borner son solde par l’emprunteur', () => {
  const { table, pretId } = tableAvecPretPropose();
  // Le prêteur se vide APRÈS avoir proposé : son solde tombe sous le principal.
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J3', montant: 10 });
  assert.ok(table.solde('J0') < 6, 'le scénario doit rendre le prêt inhonorable');

  const refus = refusDe(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true }));
  assert.equal(refus.code, 'PRET_INDISPONIBLE');
  assert.equal(refus.message, MESSAGE_IMPOSE, 'message IMPOSÉ par le contrat');
  for (const mot of ['solde', 'principal', 'prêteur', 'insuffisant']) {
    assert.ok(
      !refus.message.toLowerCase().includes(mot),
      `le message nomme « ${mot} » : il qualifie la cause du refus`,
    );
  }
});

test('ANO-08 : le refus ne dépend pas du PRINCIPAL, donc la dichotomie ne mesure rien', () => {
  // L'exploitation consistait à faire varier le principal pour encadrer le
  // solde du prêteur : deux principaux différents rendaient, l'un un refus,
  // l'autre un succès. Les deux rendent désormais le MÊME refus.
  const refus: Refus[] = [];
  for (const principal of [1, 3, 6, 11]) {
    const table = new Table({ joueurs: 6, graine: 'ano-08-dicho' })
      .demarrer()
      .allerA('NEGOCIATION');
    table.imposerRole('J0', 'PRETEUR');
    table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal });
    const pretId = table.etat.prets[0]?.id ?? '';
    // Le prêteur tombe à 0 : AUCUN principal n'est plus honorable.
    table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J3', montant: table.solde('J0') });
    refus.push(refusDe(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true })));
  }
  assert.equal(new Set(refus.map((r) => `${r.code}|${r.message}`)).size, 1);
  assert.equal(refus[0]?.code, 'PRET_INDISPONIBLE');
});

test('ANO-09 : prêt inexistant et prêt adressé à autrui sont INDISCERNABLES', () => {
  const { table, pretId } = tableAvecPretPropose('ano-09');

  const inexistant = refusDe(
    table.cmd('J2', 'repondre_pret', { pret_id: 'identifiant-inexistant', accepte: true }),
  );
  const autrui = refusDe(table.cmd('J2', 'repondre_pret', { pret_id: pretId, accepte: true }));

  assert.deepEqual(inexistant, autrui, 'un écart entre les deux EST l’oracle d’existence');
  assert.equal(inexistant.code, 'PRET_INDISPONIBLE');
  assert.equal(inexistant.message, MESSAGE_IMPOSE);
});

test('ANO-09 : un prêt déjà résolu rend le même refus que les trois autres cas', () => {
  const { table, pretId } = tableAvecPretPropose('ano-09b');
  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: false });
  assert.equal(table.etat.prets[0]?.statut, 'REFUSE');

  const rejoue = refusDe(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true }));
  assert.equal(rejoue.code, 'PRET_INDISPONIBLE');
  assert.equal(rejoue.message, MESSAGE_IMPOSE);
});

test('ANO-09 : un prêt honorable et adressé à son emprunteur est toujours acceptable', () => {
  const { table, pretId } = tableAvecPretPropose('ano-09c');
  assert.equal(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true }).ok, true);
  assert.equal(table.etat.prets[0]?.statut, 'ACTIF');
});

test('ANO-13 : un type de commande inconnu rend COMMANDE_INCONNUE, jamais une exception', () => {
  const table = new Table({ joueurs: 6, graine: 'ano-13' }).demarrer().allerA('NEGOCIATION');
  const INVENTEES = [
    'executer_pipeline',
    'emettre_revelation',
    'distribuer',
    'executer_manche',
    'reveler',
  ];

  for (const inventee of INVENTEES) {
    let resultat: ResultatCommande;
    try {
      resultat = appliquerCommande(
        table.etat,
        inventee as TypeCommande,
        {},
        {
          alea: { entier: () => 0, choisir: (l) => l[0] as never, melanger: (l) => l, booleen: () => false },
          horloge: { maintenant: () => 0 },
          identifiant: () => 'id',
          auteur_joueur_id: 'J0',
        },
      );
    } catch (erreur) {
      assert.fail(`${inventee} a levé une exception : ${String(erreur)}`);
    }
    assert.equal(resultat.ok, false, `${inventee} doit être REFUSÉE`);
    assert.equal(refusDe(resultat).code, 'COMMANDE_INCONNUE');
    if (resultat.ok) return;
    assert.equal(resultat.etat, table.etat, 'aucune erreur ne modifie l’état (CA-43)');
  }
});
