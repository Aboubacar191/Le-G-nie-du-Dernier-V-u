// CA-43 — US-16. Étant donné un client MODIFIÉ, quand il envoie une commande
// valide pour une AUTRE phase que la phase courante, alors le serveur la rejette
// avec un code d'erreur SANS MODIFIER L'ÉTAT. (RG-30)

import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTIONS_PAR_PHASE } from '@gdv/moteur';
import type { Phase, TypeCommande } from '@gdv/partage';

import { Table } from '../aide/table.ts';

/** Charge syntaxiquement valide pour chaque commande phasée. */
const CHARGES: Readonly<Record<string, Record<string, unknown>>> = {
  transferer_pieces: { cible_joueur_id: 'J1', montant: 1 },
  proposer_pret: { emprunteur_joueur_id: 'J1', principal: 1 },
  repondre_pret: { pret_id: '00000000-0000-4000-8000-000000000000', accepte: true },
  declarer_contribution: { montant: 1 },
  payer_secret: { montant: 1 },
  lancer_enquete: { cible_joueur_id: 'J1' },
  accuser: { accuse_joueur_id: 'J1' },
  signer_dernier_voeu: { a_signe: true },
  avancer_phase: {},
};

const PHASES_DE_MANCHE: readonly Phase[] = [
  'VOEU',
  'NEGOCIATION',
  'DECLARATION_PAIEMENT',
  'REVELATION',
  'ENQUETES_ACCUSATIONS',
];

test('CA-43 : toute commande reçue hors de sa phase est rejetée avec ACTION_HORS_PHASE', () => {
  for (const phase of PHASES_DE_MANCHE) {
    const table = new Table({ joueurs: 6, graine: 'ca-43' }).demarrer().allerA(phase);
    const autorisees = new Set<string>(ACTIONS_PAR_PHASE[phase]);

    for (const [type, charge] of Object.entries(CHARGES)) {
      if (autorisees.has(type)) continue;
      const avant = table.etat;
      const resultat = table.cmd('J0', type as TypeCommande, charge);
      assert.equal(resultat.ok, false, `${type} devrait être refusée en phase ${phase}`);
      assert.equal(
        (resultat as { erreur: { code: string } }).erreur.code,
        'ACTION_HORS_PHASE',
        `${type} en phase ${phase}`,
      );
      assert.equal(table.etat, avant, `l’état a été modifié par ${type} en phase ${phase}`);
    }
  }
});

test('CA-43 : le refus porte la phase courante en détail, sans donnée de jeu', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-43b' }).demarrer();
  const resultat = table.cmd('J0', 'declarer_contribution', { montant: 1 });
  const erreur = (resultat as { erreur: { code: string; details?: Record<string, unknown> } })
    .erreur;
  assert.equal(erreur.code, 'ACTION_HORS_PHASE');
  assert.deepEqual(erreur.details, { phase_courante: 'VOEU' });
});

test('CA-43 : avancer_phase n’est possible QU’EN négociation (RG-72)', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-43c' }).demarrer();
  assert.equal(table.etat.phase, 'VOEU');
  assert.equal(table.cmd('J0', 'avancer_phase').ok, false);

  table.allerA('NEGOCIATION');
  assert.equal(table.cmd('J0', 'avancer_phase').ok, true);
  assert.equal(table.etat.phase, 'DECLARATION_PAIEMENT');
});

test('CA-43 : aucune commande n’est acceptée sur une partie TERMINEE', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-43d' }).demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  assert.equal(table.etat.etat_partie, 'TERMINEE');
  const resultat = table.cmd('J0', 'declarer_contribution', { montant: 1 });
  assert.equal(
    (resultat as { erreur: { code: string } }).erreur.code,
    'ETAT_PARTIE_INCOMPATIBLE',
  );
});
