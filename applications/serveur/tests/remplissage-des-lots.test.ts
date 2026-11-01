// RUP-03 — REMPLISSAGE, MESURÉ SUR LES OCTETS RÉELLEMENT ÉCRITS SUR LE SOCKET.
//
// POURQUOI CE FICHIER EXISTE, et il faut le lire avant de citer le verdict de la
// porte d'uniformité. Le contrôle U1c de npm run verifier:uniformite mesure la
// taille des charges PROJETÉES PAR LE MOTEUR : son harnais (qa/sondes/banc.ts)
// enregistre `octets: JSON.stringify(charge).length`, sans enveloppe et sans
// remplissage. L'en-tête de la porte le dit lui-même — « le harnais mesure la
// charge projetée par le moteur : il ne peut donc pas constater un remplissage
// qui n'existe pas ». Or RUP-03 impose que le remplissage soit appliqué EN
// DERNIER, juste avant l'écriture sur le socket : il est donc, par construction,
// invisible à cette instrumentation. U1c rend 55 et 71 rangs de taille inégale
// sur des charges NUES, et cette mesure-là ne dit rien de l'écart sur le fil.
//
// Ce test mesure ce que U1c voudrait mesurer : les octets du texte REMIS AU
// SOCKET. Il ne remplace pas la porte — il est tautologique au sens de
// ADR-TL-24, puisque le même dépôt écrit et mesure — mais il établit le fait que
// la porte ne peut pas établir, et il échouera si quelqu'un retire le
// remplissage.

import test from 'node:test';
import assert from 'node:assert/strict';

import type { WebSocket } from 'ws';

import {
  COMPRESSION_AUTORISEE,
  PALIER_TAILLE_OCTETS,
  TAILLE_MAX_TRAME_SORTANTE_OCTETS,
} from '@gdv/partage';

import type { Connexion } from '../src/temps-reel/registre-connexions.ts';
import { creerHarnais, type HarnaisServeur } from './aide/service-de-test.ts';
import { commander, demarrer, ouvrirPartie, type PartieOuverte } from './aide/jouer.ts';

interface Ecrite {
  readonly type: string;
  readonly sequence: number;
  readonly octets: number;
}

class SocketMesure {
  readonly ecrites: Ecrite[] = [];

  send(texte: string): void {
    const trame = JSON.parse(texte) as { type: string; sequence: number };
    this.ecrites.push({
      type: trame.type,
      sequence: trame.sequence,
      // OCTETS, et non caractères : un accent en coûte deux, et les pseudos, les
      // messages de refus et les libellés de clause en portent.
      octets: Buffer.byteLength(texte, 'utf8'),
    });
  }

  close(): void {
    /* un socket de mesure ne se referme sur rien */
  }
}

function brancher(
  harnais: HarnaisServeur,
  ouverte: PartieOuverte,
): readonly SocketMesure[] {
  return ouverte.joueurs.map((joueurId) => {
    const socket = new SocketMesure();
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

/** Une partie à effectif donné, avec de l'activité SECRÈTE de plusieurs natures. */
function jouer(harnais: HarnaisServeur, joueurs: number): readonly SocketMesure[] {
  const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs });
  const sockets = brancher(harnais, ouverte);
  demarrer(harnais.service, ouverte);
  const [premier, second] = ouverte.joueurs as [string, string];
  commander(harnais.service, ouverte, premier, 'transferer_pieces', {
    cible_joueur_id: second,
    montant: 2,
  });
  for (const joueur of ouverte.joueurs) {
    commander(harnais.service, ouverte, joueur, 'declarer_contribution', { montant: 3 });
  }
  for (const joueur of ouverte.joueurs) {
    commander(harnais.service, ouverte, joueur, 'payer_secret', {
      montant: joueur === premier ? 1 : 3,
    });
  }
  harnais.avancerHorloge(1000);
  harnais.service.boucle.traiterExpiration(ouverte.partie);
  return sockets;
}

for (const effectif of [6, 8]) {
  test(`RUP-03 : à ${String(effectif)} joueurs, les N trames d’un lot font le MÊME nombre d’octets`, () => {
    const harnais = creerHarnais({ graine: `rup-03-${String(effectif)}` });
    try {
      const sockets = jouer(harnais, effectif);
      const reference = sockets[0] as SocketMesure;
      // Le compte est ASSERTÉ et non supposé : un scénario qui n'écrirait plus
      // rien rendrait ce test vert sans rien mesurer, et c'est exactement le
      // mode de défaillance qu'un contrôle de forme doit refuser.
      assert.ok(
        reference.ecrites.length >= 20,
        `seulement ${String(reference.ecrites.length)} trame(s) mesurée(s) par joueur`,
      );
      assert.equal(
        sockets.reduce((total, socket) => total + socket.ecrites.length, 0),
        reference.ecrites.length * effectif,
        'tous les joueurs reçoivent le même nombre de trames (RG-80, U1a)',
      );

      let inegaux = 0;
      let ecartMax = 0;
      for (let rang = 0; rang < reference.ecrites.length; rang += 1) {
        const tailles = sockets.map((socket) => socket.ecrites[rang]?.octets ?? 0);
        const mini = Math.min(...tailles);
        const maxi = Math.max(...tailles);
        if (maxi === mini) continue;
        inegaux += 1;
        ecartMax = Math.max(ecartMax, maxi - mini);
      }
      assert.equal(
        inegaux,
        0,
        `${String(inegaux)} rang(s) de taille inégale sur le fil, écart maximal ` +
          `${String(ecartMax)} octets — TLS préserve les longueurs, cet écart EST la fuite`,
      );
    } finally {
      harnais.fermer();
    }
  });
}

test('RUP-03 : toute trame écrite est complétée à un multiple du palier', () => {
  const harnais = creerHarnais({ graine: 'rup-03-palier' });
  try {
    const sockets = jouer(harnais, 6);
    for (const socket of sockets) {
      for (const ecrite of socket.ecrites) {
        assert.equal(
          ecrite.octets % PALIER_TAILLE_OCTETS,
          0,
          `${ecrite.type} fait ${String(ecrite.octets)} octets : ce n’est pas un multiple de ` +
            `${String(PALIER_TAILLE_OCTETS)}`,
        );
        assert.ok(ecrite.octets <= TAILLE_MAX_TRAME_SORTANTE_OCTETS);
      }
    }
  } finally {
    harnais.fermer();
  }
});

test('RUP-03 : la trame EXEMPTÉE est complétée elle aussi, au prochain palier', () => {
  const harnais = creerHarnais({ graine: 'rup-03-exemptee' });
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    const sockets = brancher(harnais, ouverte);
    demarrer(harnais.service, ouverte);
    harnais.service.boucle.envoyerEtatComplet(ouverte.partie, ouverte.joueurs[1] as string);

    const derniere = (sockets[1] as SocketMesure).ecrites.at(-1);
    assert.equal(derniere?.type, 'etat_complet_prive');
    assert.equal(
      (derniere?.octets ?? 0) % PALIER_TAILLE_OCTETS,
      0,
      'hors lot, mais complétée : une trame nue se distinguerait de tout le reste du trafic',
    );
    // RÉSIDU DÉCLARÉ, non couvert en v1 : deux etat_complet_prive d'historiques
    // très différents peuvent tomber dans deux paliers distincts. Inscrit en
    // dette assumée (ARCHI), avec sa condition de reprise.
  } finally {
    harnais.fermer();
  }
});

test('RUP-03 : la compression reste INTERDITE, et c’est une exigence de sécurité', () => {
  // Appliquée APRÈS remplissage, elle rendrait la taille compressée fonction du
  // CONTENU : mille octets de remplissage se compriment beaucoup mieux qu'une
  // charge pleine complétée à la même taille, et l'écart réapparaîtrait sur le
  // fil. Le serveur refuse de démarrer si le contrat cesse de l'interdire.
  assert.equal(COMPRESSION_AUTORISEE, false);
});
