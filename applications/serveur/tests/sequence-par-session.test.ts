// RUP-01 — LE NUMÉRO DE SÉQUENCE EST PAR SESSION, PLUS PAR DESTINATAIRE.
//
// « Entier monotone croissant PAR SESSION, et non plus par destinataire. Les
//   huit joueurs d'une session reçoivent les MÊMES numéros de séquence, parce
//   qu'ils reçoivent désormais les mêmes trames en même temps. »
//   (API / x-temps-reel.sequencage)
//
// Ce test est le seul du dépôt qui regarde les trames RÉELLEMENT ÉCRITES sur un
// socket, enveloppe comprise. La porte verifier:uniformite mesure les charges
// PROJETÉES par le moteur et ne voit donc ni l'enveloppe, ni le numéro de
// séquence, ni le remplissage : son contrôle U1b déduit l'égalité des séquences
// de l'égalité des suites de types. Ici, elle est LUE.
//
// Trois invariants, et le troisième est celui qui a coûté le plus cher :
//   1. à tout rang, les N joueurs portent le MÊME numéro ;
//   2. la suite est monotone et sans trou — c'est ce qu'un client détecte ;
//   3. une (re)connexion ne CONSOMME PAS de numéro et n'en remet AUCUN à 1.
//      Un etat_complet_prive qui consommerait un numéro creuserait un trou chez
//      les N−1 autres joueurs, qui se reconnecteraient en boucle, et chaque
//      reconnexion en creuserait un nouveau.

import test from 'node:test';
import assert from 'node:assert/strict';

import type { WebSocket } from 'ws';

import type { Connexion } from '../src/temps-reel/registre-connexions.ts';
import { creerHarnais, type HarnaisServeur } from './aide/service-de-test.ts';
import { commander, demarrer, ouvrirPartie, type PartieOuverte } from './aide/jouer.ts';

interface TrameLue {
  readonly type: string;
  readonly sequence: number;
}

/** Socket factice : il ne fait rien d'autre que retenir ce qu'on lui écrit. */
class SocketFactice {
  readonly recues: TrameLue[] = [];
  ferme = false;

  send(texte: string): void {
    const trame = JSON.parse(texte) as { type: string; sequence: number };
    this.recues.push({ type: trame.type, sequence: trame.sequence });
  }

  close(): void {
    this.ferme = true;
  }
}

/** Branche un socket factice par joueur, comme le fait authentifierSocket. */
function brancher(
  harnais: HarnaisServeur,
  ouverte: PartieOuverte,
): readonly SocketFactice[] {
  return ouverte.joueurs.map((joueurId) => {
    const socket = new SocketFactice();
    const connexion: Connexion = {
      socket: socket as unknown as WebSocket,
      joueur_id: joueurId,
      session_id: ouverte.session_id,
      pongs_manques: 0,
      depassements: 0,
      horodatages_commandes: [],
    };
    harnais.service.registre.lier(connexion);
    return socket;
  });
}

const sequences = (socket: SocketFactice): readonly number[] =>
  socket.recues.map((trame) => trame.sequence);

test('RUP-01 : les N joueurs d’une session reçoivent les MÊMES numéros de séquence', () => {
  const harnais = creerHarnais({ graine: 'rup-01' });
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    const sockets = brancher(harnais, ouverte);
    demarrer(harnais.service, ouverte);
    for (const joueur of ouverte.joueurs) {
      commander(harnais.service, ouverte, joueur, 'declarer_contribution', { montant: 2 });
    }

    const reference = sockets[0] as SocketFactice;
    assert.ok(reference.recues.length > 0, 'le scénario doit émettre des trames');
    for (const socket of sockets) {
      assert.deepEqual(
        sequences(socket),
        sequences(reference),
        'RUP-01 : une divergence de séquence entre destinataires signale une trame ' +
          'adressée sélectivement',
      );
      assert.deepEqual(
        socket.recues.map((trame) => trame.type),
        reference.recues.map((trame) => trame.type),
        'RG-80 : même suite de types, donc même lot',
      );
    }
  } finally {
    harnais.fermer();
  }
});

test('RUP-01 : le compteur d’une session neuve part de 0 et sa première trame porte 1', () => {
  const harnais = creerHarnais({ graine: 'rup-01-depart' });
  try {
    // Effectif 1 : la création n'émet rien, aucune adhésion ne l'a précédée.
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 1 });
    const sockets = brancher(harnais, ouverte);
    assert.equal(
      harnais.service.diffuseur.sequenceDe(ouverte.session_id),
      0,
      'une session qui n’a rien émis n’a consommé aucun numéro',
    );

    harnais.service.boucle.signalerPresence(ouverte.partie, ouverte.joueurs[0] as string, true);
    assert.deepEqual(sequences(sockets[0] as SocketFactice), [1]);
  } finally {
    harnais.fermer();
  }
});

test('RUP-01 : la séquence est monotone et sans trou pour toute la durée du socket', () => {
  const harnais = creerHarnais({ graine: 'rup-01-monotone' });
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    const sockets = brancher(harnais, ouverte);
    // Les adhésions ont déjà fait courir le compteur : un socket branché en
    // cours de route ne voit pas les trames antérieures, et ce n'est pas un trou.
    const depart = harnais.service.diffuseur.sequenceDe(ouverte.session_id);
    assert.ok(depart > 0, 'les adhésions ont émis');
    demarrer(harnais.service, ouverte);

    const lues = sequences(sockets[0] as SocketFactice);
    assert.ok(lues.length > 0);
    lues.forEach((numero, rang) => {
      assert.equal(numero, depart + rang + 1, `rang ${String(rang)} : aucun trou, aucun doublon`);
    });
  } finally {
    harnais.fermer();
  }
});

test('RUP-01 : etat_complet_prive ne consomme AUCUN numéro et n’en remet aucun à 1', () => {
  const harnais = creerHarnais({ graine: 'rup-01-reconnexion' });
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    const sockets = brancher(harnais, ouverte);
    const depart = harnais.service.diffuseur.sequenceDe(ouverte.session_id);
    demarrer(harnais.service, ouverte);
    const avant = harnais.service.diffuseur.sequenceDe(ouverte.session_id);
    assert.ok(avant > 1, 'le compteur de session a déjà couru');

    const reconnecte = ouverte.joueurs[2] as string;
    harnais.service.boucle.envoyerEtatComplet(ouverte.partie, reconnecte);

    assert.equal(
      harnais.service.diffuseur.sequenceDe(ouverte.session_id),
      avant,
      'RUP-01 : une trame exemptée n’incrémente pas le compteur de session',
    );

    const socket = sockets[2] as SocketFactice;
    const derniere = socket.recues.at(-1);
    assert.equal(derniere?.type, 'etat_complet_prive');
    assert.equal(
      derniere?.sequence,
      avant,
      '« etat_complet_prive porte la valeur courante du compteur de session » — ' +
        'aucune remise à 1',
    );

    // Les N−1 autres n'ont RIEN reçu : aucun trou ne peut donc apparaître chez eux.
    for (const [index, autre] of sockets.entries()) {
      if (index === 2) continue;
      const lues = sequences(autre);
      lues.forEach((numero, rang) => {
        assert.equal(numero, depart + rang + 1, 'aucun trou de séquence chez les non-reconnectés');
      });
    }

    // La trame suivante reprend la suite, sans saut.
    for (const joueur of ouverte.joueurs) {
      commander(harnais.service, ouverte, joueur, 'declarer_contribution', { montant: 1 });
    }
    assert.equal(sequences(socket).at(-1), harnais.service.diffuseur.sequenceDe(ouverte.session_id));
    const apres = sequences(sockets[0] as SocketFactice);
    apres.forEach((numero, rang) => {
      assert.equal(numero, depart + rang + 1, 'la suite reste sans trou après la reconnexion');
    });
  } finally {
    harnais.fermer();
  }
});
