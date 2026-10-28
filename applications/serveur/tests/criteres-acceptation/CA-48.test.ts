// CA-48 — US-18. Étant donné une partie ABANDONNÉE, quand on relit le compteur
// du groupe, alors il n'a PAS été incrémenté. (RG-59)
//
// Et RG-76 : un abandon ne révèle AUCUN secret. C'est une faille de conception
// relevée au nœud S2 : si l'abandon déclenchait une révélation, l'hôte
// disposerait d'un moyen unilatéral de forcer la divulgation des secrets de
// toute la table au moment qui l'arrange.

import test from 'node:test';
import assert from 'node:assert/strict';

import { hacher } from '../../src/securite/jetons.ts';
import { creerHarnais } from '../aide/service-de-test.ts';
import { commander, demarrer, ouvrirPartie } from '../aide/jouer.ts';

test('CA-48 : un abandon n’incrémente pas le compteur du groupe', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    demarrer(harnais.service, ouverte);
    const condensat = hacher(ouverte.jeton_groupe);
    assert.equal(harnais.depot.groupeParJeton(condensat)?.parties_terminees, 0);

    const hote = ouverte.joueurs[0] as string;
    const abandon = commander(harnais.service, ouverte, hote, 'abandonner_partie', {
      confirmation: true,
    });
    assert.equal(abandon.accepte, true);
    assert.equal(ouverte.partie.etat.etat_partie, 'ABANDONNEE');
    assert.equal(
      harnais.depot.groupeParJeton(condensat)?.parties_terminees,
      0,
      'le compteur reste à zéro',
    );
  } finally {
    harnais.fermer();
  }
});

test('CA-48 : l’abandon exige une confirmation explicite', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    demarrer(harnais.service, ouverte);
    const hote = ouverte.joueurs[0] as string;

    const sansConfirmation = commander(harnais.service, ouverte, hote, 'abandonner_partie', {
      confirmation: false,
    });
    assert.equal(sansConfirmation.accepte, false);
    assert.equal(ouverte.partie.etat.etat_partie, 'MANCHE_EN_COURS');
  } finally {
    harnais.fermer();
  }
});

test('CA-48 : l’abandon est réservé à l’hôte', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    demarrer(harnais.service, ouverte);
    const autre = ouverte.joueurs[1] as string;

    const refus = commander(harnais.service, ouverte, autre, 'abandonner_partie', {
      confirmation: true,
    });
    assert.equal(refus.accepte, false);
    assert.equal(refus.code_erreur, 'ACTION_RESERVEE_HOTE');
  } finally {
    harnais.fermer();
  }
});

test('CA-48 : un abandon ne calcule AUCUN classement et ne révèle AUCUN secret (RG-76)', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    demarrer(harnais.service, ouverte);
    // Trois manches jouées, puis abandon en pleine partie.
    for (let pas = 0; pas < 18; pas += 1) {
      harnais.avancerHorloge(1000);
      harnais.service.boucle.traiterExpiration(ouverte.partie);
    }
    const hote = ouverte.joueurs[0] as string;
    commander(harnais.service, ouverte, hote, 'abandonner_partie', { confirmation: true });

    assert.equal(ouverte.partie.etat.etat_partie, 'ABANDONNEE');
    assert.equal(ouverte.partie.etat.classement, null, 'aucun classement calculé');
    assert.equal(ouverte.partie.etat.phase, null, 'aucune phase ne court plus');
    assert.equal(ouverte.partie.etat.genie_libere, null);
  } finally {
    harnais.fermer();
  }
});

test('CA-48 : le code d’adhésion d’une session abandonnée est réutilisable', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge);
    const code = ouverte.code_adhesion;
    const hote = ouverte.joueurs[0] as string;
    commander(harnais.service, ouverte, hote, 'abandonner_partie', { confirmation: true });
    harnais.depot.synchroniser(ouverte.partie.etat);

    // L'index unique est PARTIEL : il ne porte que sur les sessions vivantes.
    assert.equal(
      harnais.depot.sessionParCode(code),
      undefined,
      'la session abandonnée n’est plus trouvable par son code',
    );
  } finally {
    harnais.fermer();
  }
});
