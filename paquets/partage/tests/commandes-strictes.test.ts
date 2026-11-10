// OBJET STRICT OBLIGATOIRE — règle 1 de stack._prescription_migration_zod.
//
//   « Objets STRICTS obligatoires pour toute commande entrante : une clé
//     inconnue est un refus MESSAGE_MALFORME, jamais un dépouillement
//     silencieux. En Zod 4 l'objet par défaut dépouille les clés inconnues —
//     c'est précisément le comportement interdit ici, car il transforme une
//     trame malformée en trame acceptée. Le schéma strict est imposé, son usage
//     est vérifié par UN TEST PAR COMMANDE. »
//
// Le piège est réel et mesuré sur Zod 4.6.7 : z.object({montant}).parse(
// {montant: 4, injecte: 'x'}) rend {montant: 4} AVEC SUCCÈS. Une tentative
// d'usurpation d'identité (CA-44) deviendrait ainsi une commande valide, et le
// serveur n'aurait plus rien à détecter.

import test from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { SCHEMAS_COMMANDE, TYPES_COMMANDE, type TypeCommande } from '../src/protocole/commandes.ts';
import { SchemaEnveloppeCommande } from '../src/protocole/enveloppe.ts';
import { schemaContrat } from '../src/contrat/lecture.ts';

const UUID = '0d0a0f02-5e2a-4c3e-9f1a-2b7c4d8e9a10';

/** Une charge VALIDE par commande, pour pouvoir y injecter une clé inconnue. */
const CHARGES_VALIDES: Readonly<Record<TypeCommande, Record<string, unknown>>> = {
  authentifier: { jeton_session: 'a'.repeat(43), version_protocole: '1.0.0' },
  definir_ordre_places: { ordre: [UUID, UUID.replace('10', '11')] },
  demarrer_partie: {},
  avancer_phase: {},
  transferer_pieces: { cible_joueur_id: UUID, montant: 2 },
  proposer_pret: { emprunteur_joueur_id: UUID, principal: 3 },
  repondre_pret: { pret_id: UUID, accepte: true },
  declarer_contribution: { montant: 4 },
  payer_secret: { montant: 1 },
  lancer_enquete: { cible_joueur_id: UUID },
  accuser: { accuse_joueur_id: UUID },
  signer_dernier_voeu: { a_signe: true },
  abandonner_partie: { confirmation: true },
  signaler_pret: { pret: true },
};

test('le piège de Zod 4 est réel : z.object DÉPOUILLE, z.strictObject REFUSE', () => {
  const lache = z.object({ montant: z.number() });
  const strict = z.strictObject({ montant: z.number() });
  const entree = { montant: 4, injecte: 'x' };

  const dépouille = lache.safeParse(entree);
  assert.equal(dépouille.success, true, 'c’est bien le comportement par défaut de Zod 4');
  assert.deepEqual(dépouille.data, { montant: 4 }, 'la clé inconnue a disparu sans un mot');

  const refus = strict.safeParse(entree);
  assert.equal(refus.success, false);
  assert.equal(refus.error?.issues[0]?.code, 'unrecognized_keys');
});

test('les 14 commandes du contrat ont un schéma', () => {
  assert.equal(TYPES_COMMANDE.length, 14);
  assert.deepEqual(Object.keys(SCHEMAS_COMMANDE).sort(), [...TYPES_COMMANDE].sort());
});

for (const type of TYPES_COMMANDE) {
  test(`${type} : la charge valide est acceptée`, () => {
    const resultat = SCHEMAS_COMMANDE[type].safeParse(CHARGES_VALIDES[type]);
    assert.equal(resultat.success, true, JSON.stringify(resultat.error?.issues));
  });

  test(`${type} : une clé inconnue est REFUSÉE, pas dépouillée`, () => {
    const avecIntrus = { ...CHARGES_VALIDES[type], champ_inconnu: 'injecte' };
    const resultat = SCHEMAS_COMMANDE[type].safeParse(avecIntrus);
    assert.equal(resultat.success, false, `${type} dépouille au lieu de refuser`);
  });

  test(`${type} : une tentative d’usurpation par joueur_id est REFUSÉE`, () => {
    const avecAuteur = { ...CHARGES_VALIDES[type], joueur_id: UUID };
    const resultat = SCHEMAS_COMMANDE[type].safeParse(avecAuteur);
    assert.equal(
      resultat.success,
      false,
      `${type} accepte un champ d’auteur : CA-44 serait indétectable`,
    );
  });
}

test('toute collection entrante porte une cardinalité maximale (règle 2)', () => {
  const maximum = (
    schemaContrat('CmdDefinirOrdrePlaces').properties?.ordre as { maxItems?: number } | undefined
  )?.maxItems;
  assert.equal(typeof maximum, 'number', 'le contrat doit porter maxItems');
  const trop = Array.from({ length: (maximum ?? 0) + 1 }, (_, index) =>
    UUID.replace('10', String(20 + index)),
  );
  assert.equal(SCHEMAS_COMMANDE.definir_ordre_places.safeParse({ ordre: trop }).success, false);
  // Et aucune autre commande ne transporte de collection.
  const avecCollection = Object.entries(CHARGES_VALIDES).filter(([, charge]) =>
    Object.values(charge).some((valeur) => Array.isArray(valeur)),
  );
  assert.deepEqual(
    avecCollection.map(([nom]) => nom),
    ['definir_ordre_places'],
  );
});

test('toute chaîne entrante porte une longueur maximale (règle 3)', () => {
  const trop = 'a'.repeat(1000);
  assert.equal(
    SCHEMAS_COMMANDE.authentifier.safeParse({
      jeton_session: trop,
      version_protocole: '1.0.0',
    }).success,
    false,
  );
  assert.equal(
    SCHEMAS_COMMANDE.authentifier.safeParse({
      jeton_session: 'a'.repeat(43),
      version_protocole: trop,
    }).success,
    false,
  );
});

test('tout entier entrant est borné en bas ET en haut (règle 4)', () => {
  assert.equal(SCHEMAS_COMMANDE.declarer_contribution.safeParse({ montant: -1 }).success, false);
  assert.equal(
    SCHEMAS_COMMANDE.declarer_contribution.safeParse({ montant: 10_000_000 }).success,
    false,
  );
  assert.equal(SCHEMAS_COMMANDE.declarer_contribution.safeParse({ montant: 1.5 }).success, false);
  assert.equal(SCHEMAS_COMMANDE.proposer_pret.safeParse({
    emprunteur_joueur_id: UUID,
    principal: 0,
  }).success, false, 'le contrat exige principal >= 1');
});

test('l’ordre des places refuse les doublons (uniqueItems du contrat)', () => {
  assert.equal(
    SCHEMAS_COMMANDE.definir_ordre_places.safeParse({ ordre: [UUID, UUID] }).success,
    false,
  );
});

test('abandonner_partie exige confirmation === true, pas un booléen quelconque', () => {
  assert.equal(SCHEMAS_COMMANDE.abandonner_partie.safeParse({ confirmation: false }).success, false);
  assert.equal(SCHEMAS_COMMANDE.abandonner_partie.safeParse({}).success, false);
});

test('l’ENVELOPPE est stricte aussi : un champ d’auteur ne peut pas s’y glisser', () => {
  const enveloppe = { id_correlation: UUID, type: 'declarer_contribution', charge: { montant: 1 } };
  assert.equal(SchemaEnveloppeCommande.safeParse(enveloppe).success, true);
  assert.equal(
    SchemaEnveloppeCommande.safeParse({ ...enveloppe, joueur_id: UUID }).success,
    false,
    'dépouiller ici transformerait une usurpation en trame valide',
  );
  assert.equal(
    SchemaEnveloppeCommande.safeParse({ ...enveloppe, type: 'executer_pipeline' }).success,
    false,
    'un type absent du catalogue est refusé (CA-50)',
  );
});
