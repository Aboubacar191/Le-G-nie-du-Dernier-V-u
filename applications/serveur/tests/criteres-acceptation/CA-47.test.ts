// CA-47 — US-18. Étant donné un groupe ayant terminé 2 parties, quand une 3e
// session est créée, alors le mode avancé n'est PAS actif ; après la 3e partie
// terminée, la 4e session l'active automatiquement. (RG-50)

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerPartie, creerService } from '../../src/service.ts';
import { hacher } from '../../src/securite/jetons.ts';
import { creerHarnais } from '../aide/service-de-test.ts';
import { jouerPartieComplete, ouvrirPartie } from '../aide/jouer.ts';

test('CA-47 : le mode avancé se débloque à la 3e partie TERMINÉE, pas avant', () => {
  const harnais = creerHarnais();
  try {
    const premiere = jouerPartieComplete(harnais.service, harnais.avancerHorloge);
    const jetonGroupe = premiere.jeton_groupe;
    assert.equal(premiere.mode_avance_actif, false, 'partie 1 : groupe neuf');

    const groupeApres1 = harnais.depot.groupeParJeton(hacher(jetonGroupe));
    assert.equal(groupeApres1?.parties_terminees, 1);

    const deuxieme = jouerPartieComplete(harnais.service, harnais.avancerHorloge, {
      jeton_groupe: jetonGroupe,
    });
    assert.equal(deuxieme.mode_avance_actif, false, 'partie 2 : 1 partie au compteur');
    assert.equal(harnais.depot.groupeParJeton(hacher(jetonGroupe))?.parties_terminees, 2);

    // Troisième session créée alors que le compteur vaut 2 : mode avancé INACTIF.
    const troisieme = jouerPartieComplete(harnais.service, harnais.avancerHorloge, {
      jeton_groupe: jetonGroupe,
    });
    assert.equal(troisieme.mode_avance_actif, false, 'CA-47 : 2 parties ne suffisent pas');
    assert.equal(harnais.depot.groupeParJeton(hacher(jetonGroupe))?.parties_terminees, 3);

    // Quatrième session : le compteur vaut 3, le seuil est atteint.
    const quatrieme = ouvrirPartie(harnais.service, harnais.avancerHorloge, {
      jeton_groupe: jetonGroupe,
    });
    assert.equal(quatrieme.mode_avance_actif, true, 'CA-47 : activation automatique');
    assert.equal(quatrieme.partie.etat.mode_avance_actif, true);
  } finally {
    harnais.fermer();
  }
});

test('CA-47 : l’hôte peut forcer le mode avancé — interrupteur de test (RG-50)', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, {
      activer_mode_avance: true,
    });
    assert.equal(ouverte.mode_avance_actif, true, 'même sur un groupe neuf');
  } finally {
    harnais.fermer();
  }
});

test('CA-47 : un jeton de groupe inconnu est refusé, aucun groupe n’est créé', () => {
  const harnais = creerHarnais();
  try {
    const resultat = creerPartie(harnais.service, {
      pseudo: 'Hote',
      jeton_groupe: 'jeton-inexistant',
    });
    assert.equal(resultat.ok, false);
    if (resultat.ok) return;
    assert.equal(resultat.code, 'JETON_INVALIDE');
  } finally {
    harnais.fermer();
  }
});

test('CA-47 : le compteur de groupe SURVIT à un redémarrage (RG-50, ADR-TL-04)', () => {
  const harnais = creerHarnais();
  try {
    const premiere = jouerPartieComplete(harnais.service, harnais.avancerHorloge);
    const condensat = hacher(premiere.jeton_groupe);
    assert.equal(harnais.depot.groupeParJeton(condensat)?.parties_terminees, 1);

    // Un nouveau service sur LE MÊME dépôt : c'est ce que fait un redémarrage.
    const serviceRedemarre = creerService(harnais.depot, () => 1_800_000_000_000);
    const suivante = creerPartie(serviceRedemarre, {
      pseudo: 'Hote',
      jeton_groupe: premiere.jeton_groupe,
    });
    assert.equal(suivante.ok, true);
    assert.equal(harnais.depot.groupeParJeton(condensat)?.parties_terminees, 1);
    serviceRedemarre.ordonnanceur.arreter();
  } finally {
    harnais.fermer();
  }
});
