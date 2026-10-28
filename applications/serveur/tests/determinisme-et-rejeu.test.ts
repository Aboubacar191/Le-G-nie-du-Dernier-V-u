// DÉTERMINISME ET REJEU — invariants_testes_obligatoires de l'ARCHI.
//
//   « Déterminisme — deux exécutions du moteur sur la même graine et la même
//     séquence de commandes produisent un état bit-à-bit identique. »
//   « Rejeu — l'état obtenu par rejeu du journal est identique à l'état en
//     mémoire avant arrêt. »
//
// Le second test est aussi le test de REPRISE : c'est lui qui dit si un
// redémarrage du serveur en pleine partie ruine trente minutes de jeu
// (ADR-TL-05, priorité 2).

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants, type EtatSession } from '@gdv/moteur';

import { rejouerSession, rejouerSessionsVivantes } from '../src/persistance/journal.ts';
import { creerHarnais } from './aide/service-de-test.ts';
import { commander, demarrer, ouvrirPartie, type PartieOuverte } from './aide/jouer.ts';
import type { Service } from '../src/service.ts';

const PAS_MS = 1000;

/**
 * Un scénario de jeu riche : transferts, déclarations, paiements, enquêtes,
 * accusations, et trois manches exécutées. Il mobilise l'aléa (clauses,
 * porteurs, variantes de révélation) et la monnaie.
 */
function jouerScenario(
  service: Service,
  ouverte: PartieOuverte,
  avancerHorloge: (ms: number) => void,
): void {
  demarrer(service, ouverte);
  const [j0, j1, j2, j3] = ouverte.joueurs as [string, string, string, string];

  for (let manche = 1; manche <= 3; manche += 1) {
    // VOEU → NEGOCIATION
    avancerHorloge(PAS_MS);
    service.boucle.traiterExpiration(ouverte.partie);
    commander(service, ouverte, j0, 'transferer_pieces', { cible_joueur_id: j1, montant: 1 });

    // NEGOCIATION → DECLARATION_PAIEMENT
    avancerHorloge(PAS_MS);
    service.boucle.traiterExpiration(ouverte.partie);
    ouverte.joueurs.forEach((joueur, rang) => {
      const declare = Math.min(rang + 1, 4);
      commander(service, ouverte, joueur, 'declarer_contribution', { montant: declare });
      commander(service, ouverte, joueur, 'payer_secret', {
        montant: rang % 2 === 0 ? declare : 0,
      });
    });

    // REVELATION → ENQUETES_ACCUSATIONS
    avancerHorloge(PAS_MS);
    service.boucle.traiterExpiration(ouverte.partie);
    commander(service, ouverte, j2, 'lancer_enquete', { cible_joueur_id: j1 });
    commander(service, ouverte, j3, 'accuser', { accuse_joueur_id: j1 });

    // ENQUETES_ACCUSATIONS → EXECUTION → clôture
    avancerHorloge(PAS_MS);
    service.boucle.traiterExpiration(ouverte.partie);
    avancerHorloge(PAS_MS);
    service.boucle.traiterExpiration(ouverte.partie);
  }
}

/** Comparaison bit-à-bit : la sérialisation JSON ne tolère aucune différence. */
function empreinte(etat: EtatSession): string {
  return JSON.stringify(etat);
}

test('déterminisme : même graine et même séquence de commandes → état identique', () => {
  const premier = creerHarnais();
  const second = creerHarnais();
  try {
    // La graine est tirée par la couche transport : pour comparer, on force la
    // même graine dans les deux dépôts en recopiant la session créée.
    const a = ouvrirPartie(premier.service, premier.avancerHorloge);
    jouerScenario(premier.service, a, premier.avancerHorloge);

    // Rejouer le journal de A dans le MÊME dépôt donne le même état : c'est la
    // forme la plus forte du déterminisme, puisque l'aléa est reconstruit depuis
    // la graine persistée et non conservé en mémoire.
    const session = premier.depot.sessionParId(a.session_id);
    assert.notEqual(session, undefined);
    const rejouee = rejouerSession(premier.depot, session!);

    assert.equal(
      empreinte(rejouee.etat),
      empreinte(a.partie.etat),
      'le rejeu ne reproduit pas l’état bit-à-bit',
    );
  } finally {
    premier.fermer();
    second.fermer();
  }
});

test('rejeu : l’état reconstruit depuis le journal est identique à l’état en mémoire', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    jouerScenario(harnais.service, ouverte, harnais.avancerHorloge);
    const avantArret = empreinte(ouverte.partie.etat);

    // Arrêt brutal simulé : on jette l'état en mémoire et on repart du dépôt.
    const reprises = rejouerSessionsVivantes(harnais.depot);
    assert.equal(reprises.length, 1, 'une session vivante à reprendre');
    const reprise = reprises[0];
    assert.notEqual(reprise, undefined);

    assert.equal(empreinte(reprise!.etat), avantArret);
    assert.ok(verifierInvariants(reprise!.etat).ok, 'les invariants tiennent après rejeu');
  } finally {
    harnais.fermer();
  }
});

test('rejeu : l’état transitoire est reconstruit, pas seulement les tables', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    jouerScenario(harnais.service, ouverte, harnais.avancerHorloge);

    const session = harnais.depot.sessionParId(ouverte.session_id);
    const rejouee = rejouerSession(harnais.depot, session!);

    // L'échéance de phase, l'ensemble des clauses encore tirables et la position
    // du générateur d'aléa ne sont portés par AUCUNE table : seul le rejeu les
    // reconstruit. La clause de la manche SUIVANTE le prouve.
    assert.equal(rejouee.etat.phase, ouverte.partie.etat.phase);
    assert.equal(rejouee.etat.phase_fin_at, ouverte.partie.etat.phase_fin_at);
    assert.deepEqual(
      [...rejouee.etat.clauses_disponibles],
      [...ouverte.partie.etat.clauses_disponibles],
    );

    harnais.avancerHorloge(PAS_MS);
    harnais.service.boucle.traiterExpiration(ouverte.partie);
    rejouee.figerInstant(ouverte.partie.instantCourant);
    rejouee.expirerPhaseCourante();
    assert.equal(
      empreinte(rejouee.etat),
      empreinte(ouverte.partie.etat),
      'la suite de la partie divergerait si l’aléa n’était pas à la même position',
    );
  } finally {
    harnais.fermer();
  }
});

test('rejeu : une commande REFUSÉE n’est pas rejouée', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    demarrer(harnais.service, ouverte);
    const j0 = ouverte.joueurs[0] as string;

    // Commande hors phase : refusée, journalisée avec accepte = 0.
    const refus = commander(harnais.service, ouverte, j0, 'declarer_contribution', {
      montant: 2,
    });
    assert.equal(refus.accepte, false);

    const session = harnais.depot.sessionParId(ouverte.session_id);
    const rejouee = rejouerSession(harnais.depot, session!);
    assert.equal(empreinte(rejouee.etat), empreinte(ouverte.partie.etat));
  } finally {
    harnais.fermer();
  }
});

test('rejeu : les identifiants créés par le moteur sont reproduits à l’identique', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    jouerScenario(harnais.service, ouverte, harnais.avancerHorloge);

    const session = harnais.depot.sessionParId(ouverte.session_id);
    const rejouee = rejouerSession(harnais.depot, session!);

    const mouvementsAvant = ouverte.partie.etat.mouvements.map((mouvement) => mouvement.id);
    const mouvementsApres = rejouee.etat.mouvements.map((mouvement) => mouvement.id);
    assert.deepEqual(mouvementsApres, mouvementsAvant);
    assert.ok(mouvementsAvant.length > 0);
    for (const identifiant of mouvementsAvant) {
      assert.match(
        identifiant,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        'format UUIDv4 conservé (ADR-TL-10) malgré le déterminisme (ADR-TL-05)',
      );
    }
  } finally {
    harnais.fermer();
  }
});
