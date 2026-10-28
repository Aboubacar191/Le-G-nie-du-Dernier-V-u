// CA-01 — US-01. Étant donné aucune session existante, quand un hôte crée une
// session, alors un code d'adhésion est émis, affichable aussi en QR, et la
// session est en état CREEE puis SALLE_ATTENTE dès le premier joueur rejoint.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerPartie, rejoindrePartie } from '../../src/service.ts';
import { creerHarnais } from '../aide/service-de-test.ts';

const MOTIF_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

test('CA-01 : la création émet un code d’adhésion sans caractère ambigu', () => {
  const harnais = creerHarnais();
  try {
    const resultat = creerPartie(harnais.service, { pseudo: 'Hote' });
    assert.equal(resultat.ok, true);
    if (!resultat.ok) return;

    assert.match(resultat.code_adhesion, MOTIF_CODE);
    for (const interdit of ['I', 'O', '0', '1']) {
      assert.ok(
        !resultat.code_adhesion.includes(interdit),
        `le code contient ${interdit}, ambigu à voix haute`,
      );
    }
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : la session naît en CREEE, l’hôte inscrit comme premier joueur', () => {
  const harnais = creerHarnais();
  try {
    const resultat = creerPartie(harnais.service, { pseudo: 'Hote' });
    if (!resultat.ok) throw new Error('création refusée');

    const partie = harnais.service.boucle.partie(resultat.session_id);
    assert.equal(partie?.etat.etat_partie, 'CREEE');
    assert.equal(partie?.etat.joueurs.length, 1);
    assert.equal(partie?.etat.joueurs[0]?.est_hote, true);
    assert.equal(partie?.etat.joueurs[0]?.pseudo, 'Hote');
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : la session passe en SALLE_ATTENTE dès le premier joueur qui rejoint', () => {
  const harnais = creerHarnais();
  try {
    const creation = creerPartie(harnais.service, { pseudo: 'Hote' });
    if (!creation.ok) throw new Error('création refusée');

    const adhesion = rejoindrePartie(harnais.service, creation.code_adhesion, 'Deuxieme');
    assert.equal(adhesion.ok, true);

    const partie = harnais.service.boucle.partie(creation.session_id);
    assert.equal(partie?.etat.etat_partie, 'SALLE_ATTENTE');
    assert.equal(partie?.etat.joueurs.length, 2);
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : les jetons sont émis une seule fois et stockés HACHÉS (ADR-TL-15)', () => {
  const harnais = creerHarnais();
  try {
    const creation = creerPartie(harnais.service, { pseudo: 'Hote' });
    if (!creation.ok) throw new Error('création refusée');

    // Le jeton en clair n'est nulle part en base : seul son condensat y est.
    const identite = harnais.depot.identiteParJeton(creation.jeton_session);
    assert.equal(identite, undefined, 'le jeton en clair n’est pas une clé de recherche');

    const joueurs = harnais.depot.joueursDe(creation.session_id);
    assert.equal(joueurs.length, 1);
    assert.notEqual(joueurs[0]?.jeton_hache, creation.jeton_session);
    assert.match(joueurs[0]?.jeton_hache ?? '', /^[0-9a-f]{64}$/, 'SHA-256 hexadécimal');
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : la configuration effective est figée et persistée à la création', () => {
  const harnais = creerHarnais();
  try {
    const creation = creerPartie(harnais.service, {
      pseudo: 'Hote',
      config_surchargee: { objectif_par_joueur: 4 },
    });
    if (!creation.ok) throw new Error('création refusée');
    assert.equal(creation.config.objectif_par_joueur, 4);

    const session = harnais.depot.sessionParId(creation.session_id);
    const config = JSON.parse(session?.config_json ?? '{}') as { objectif_par_joueur: number };
    assert.equal(config.objectif_par_joueur, 4);
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : une surcharge hors bornes est refusée, aucune session n’est créée', () => {
  const harnais = creerHarnais();
  try {
    const resultat = creerPartie(harnais.service, {
      pseudo: 'Hote',
      config_surchargee: { joueurs_max: 999 },
    });
    assert.equal(resultat.ok, false);
    if (resultat.ok) return;
    assert.equal(resultat.code, 'CONFIG_INVALIDE');
    assert.equal(harnais.service.boucle.sessions().length, 0);
  } finally {
    harnais.fermer();
  }
});

test('CA-01 : deux sessions actives peuvent porter le même pseudo de joueur', () => {
  const harnais = creerHarnais();
  try {
    const a = creerPartie(harnais.service, { pseudo: 'Amina' });
    const b = creerPartie(harnais.service, { pseudo: 'Amina' });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.session_id, b.session_id);
    assert.notEqual(a.code_adhesion, b.code_adhesion);
  } finally {
    harnais.fermer();
  }
});
