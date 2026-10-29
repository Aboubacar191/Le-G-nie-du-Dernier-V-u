// PREUVE — le cercle affiché correspond au cercle PHYSIQUE (RG-06), et la
// machine du voile ne laisse aucun chemin ouvert (M1, M2, M3, M5).
//
// Propriété vérifiable que tout le dispositif doit tenir : « le joueur assis
// physiquement à sa gauche apparaît à gauche à l'écran ». Sans elle, le gabarit
// de révélation VOISINAGE produit des énoncés vrais et incompréhensibles.
//
// Rappel de la convention de saisie : l'hôte part de lui-même et tourne vers sa
// GAUCHE, ce qui est le sens horaire vu de dessus de la table. Donc
// ordre[k + 1] est le voisin de gauche de ordre[k]. Au rendu, tourner dans le
// sens horaire depuis le bas de l'écran va vers la gauche (6 h → 7 h → 9 h).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disposerCercle,
  inverserSens,
  ordreEstValide,
  relationPour,
  voisinDeDroite,
  voisinDeGauche,
} from '../src/logique/positions-cercle.ts';
import {
  cleLibelle,
  estRevele,
  ETATS_VOILE,
  transiter,
  zoneActionnable,
  type EtatVoile,
} from '../src/logique/voile.ts';

const TABLE = ['moi', 'awa', 'koffi', 'moussa', 'fatou', 'yao'];

// --- Correspondance physique --------------------------------------------------

test('ma carte est en bas du cercle, à 6 heures', () => {
  const places = disposerCercle(TABLE, 'moi');
  const moi = places[0];
  assert.equal(moi?.joueur_id, 'moi');
  assert.equal(moi?.relation, 'moi');
  assert.equal(moi?.angle_degres, 90);
  // Axe écran : y positif vers le bas. Ma carte est donc au bas du cercle.
  assert.ok((moi?.y ?? 0) > 0.99, `ordonnée ${moi?.y}`);
  assert.ok(Math.abs(moi?.x ?? 1) < 1e-9, `abscisse ${moi?.x}`);
});

test('LE VOISIN DE GAUCHE APPARAÎT À GAUCHE — la propriété décisive', () => {
  const places = disposerCercle(TABLE, 'moi');
  const gauche = places.find((place) => place.relation === 'gauche');
  assert.equal(gauche?.joueur_id, 'awa', 'ordre[moi + 1] est le voisin de gauche');
  // Abscisse NÉGATIVE : la carte est du côté gauche de l'écran.
  assert.ok((gauche?.x ?? 0) < 0, `le voisin de gauche est à x = ${gauche?.x}`);
});

test('le voisin de droite apparaît à droite', () => {
  const places = disposerCercle(TABLE, 'moi');
  const droite = places.find((place) => place.relation === 'droite');
  assert.equal(droite?.joueur_id, 'yao', 'ordre[moi − 1] est le voisin de droite');
  assert.ok((droite?.x ?? 0) > 0, `le voisin de droite est à x = ${droite?.x}`);
});

test('chaque joueur voit sa PROPRE carte en bas, et ses vrais voisins à côté', () => {
  for (const [index, joueur] of TABLE.entries()) {
    const places = disposerCercle(TABLE, joueur);
    assert.equal(places[0]?.joueur_id, joueur, `${joueur} doit être en bas de son cercle`);

    const attenduGauche = TABLE[(index + 1) % TABLE.length];
    const attenduDroite = TABLE[(index - 1 + TABLE.length) % TABLE.length];
    assert.equal(voisinDeGauche(TABLE, joueur), attenduGauche);
    assert.equal(voisinDeDroite(TABLE, joueur), attenduDroite);
  }
});

test('le cercle est CYCLIQUE : le dernier est voisin du premier (RG-06)', () => {
  assert.equal(voisinDeGauche(TABLE, 'yao'), 'moi');
  assert.equal(voisinDeDroite(TABLE, 'moi'), 'yao');
});

test('la relation de voisinage est annoncée pour 5 comme pour 8 joueurs', () => {
  for (const effectif of [5, 6, 7, 8]) {
    const table = Array.from({ length: effectif }, (_, index) => `j${index}`);
    const places = disposerCercle(table, 'j0');
    assert.equal(places.length, effectif);
    assert.equal(places.filter((place) => place.relation === 'gauche').length, 1);
    assert.equal(places.filter((place) => place.relation === 'droite').length, 1);
    assert.equal(places.filter((place) => place.relation === 'moi').length, 1);
  }
});

test('un ordre inconnu ne produit AUCUNE position devinée', () => {
  assert.deepEqual([...disposerCercle(TABLE, 'inconnu')], []);
  assert.deepEqual([...disposerCercle([], 'moi')], []);
  assert.equal(voisinDeGauche([], 'moi'), null);
});

test('un ordre incomplet ou à doublon est refusé (RG-06, CA-04)', () => {
  assert.equal(ordreEstValide(TABLE, TABLE), true);
  assert.equal(ordreEstValide(['moi', 'awa'], TABLE), false, 'permutation incomplète');
  assert.equal(ordreEstValide(['moi', 'moi', 'awa'], ['moi', 'awa', 'koffi']), false, 'doublon');
  assert.equal(ordreEstValide(['moi', 'awa', 'intrus'], ['moi', 'awa', 'koffi']), false);
});

test('inverser le sens garde l’hôte en premier et retourne le reste', () => {
  assert.deepEqual([...inverserSens(TABLE)], ['moi', 'yao', 'fatou', 'moussa', 'koffi', 'awa']);
  // À deux, inverser n'a pas de sens : l'ordre est son propre inverse.
  assert.deepEqual([...inverserSens(['a', 'b'])], ['a', 'b']);
});

test('à trois joueurs, le même voisin n’est pas à la fois à gauche et à droite', () => {
  const trio = ['moi', 'awa', 'koffi'];
  assert.equal(relationPour(1, 3), 'gauche');
  assert.equal(relationPour(2, 3), 'droite');
  assert.notEqual(voisinDeGauche(trio, 'moi'), voisinDeDroite(trio, 'moi'));
});

// --- Machine du voile ---------------------------------------------------------

test('les neuf états du contrat existent, ni plus ni moins', () => {
  assert.equal(ETATS_VOILE.length, 9);
  assert.deepEqual([...ETATS_VOILE].sort(), [
    'actif', 'chargement', 'desactive', 'erreur', 'focus',
    'masque', 'revele_maintenu', 'revele_minute', 'scelle',
  ]);
});

test('M1 — l’état d’arrivée est TOUJOURS masqué, depuis n’importe quel état', () => {
  for (const depart of ETATS_VOILE) {
    assert.equal(transiter(depart, 'arriver'), 'masque', `depuis ${depart}`);
  }
});

test('M2 — la révélation exige un geste : aucune transition passive n’y mène', () => {
  // Depuis l'état masqué, seuls un maintien ou un contact simple révèlent.
  const passifs = ['arriver', 'charger', 'remasquer', 'defocaliser', 'focaliser'] as const;
  for (const evenement of passifs) {
    assert.ok(!estRevele(transiter('masque', evenement)), `${evenement} ne doit rien révéler`);
  }
  assert.equal(transiter(transiter('masque', 'presser'), 'maintenir'), 'revele_maintenu');
  assert.equal(transiter('masque', 'contact_simple'), 'revele_minute');
});

test('M2 — un maintien sans pression préalable ne révèle rien', () => {
  assert.equal(transiter('masque', 'maintenir'), 'masque');
});

test('M3 — chacune des cinq causes de remasquage ramène à masqué', () => {
  for (const depart of ['revele_maintenu', 'revele_minute', 'actif', 'focus'] as EtatVoile[]) {
    assert.equal(transiter(depart, 'remasquer'), 'masque', `depuis ${depart}`);
    assert.equal(transiter(depart, 'defocaliser'), 'masque', `depuis ${depart}`);
  }
});

test('M5 — un acte scellé ne se rouvre JAMAIS', () => {
  const tentatives = [
    'presser', 'maintenir', 'contact_simple', 'focaliser', 'echouer', 'desactiver',
  ] as const;
  for (const evenement of tentatives) {
    assert.equal(transiter('scelle', evenement), 'scelle', `${evenement} ne doit pas rouvrir`);
  }
  // Seule une NOUVELLE arrivée d'écran réinitialise, et elle réinitialise à masqué.
  assert.equal(transiter('scelle', 'arriver'), 'masque');
});

test('un voile désactivé ne révèle rien et n’est pas actionnable', () => {
  assert.equal(transiter('desactive', 'contact_simple'), 'desactive');
  assert.equal(zoneActionnable('desactive'), false);
  assert.equal(zoneActionnable('chargement'), false);
  assert.equal(zoneActionnable('scelle'), false);
  assert.equal(zoneActionnable('masque'), true);
});

test('chaque état porte une CLÉ de libellé, jamais un texte', () => {
  for (const etat of ETATS_VOILE) {
    const cle = cleLibelle(etat);
    assert.match(cle, /^voile\.[a-z_]+$/u, `${etat} → ${cle}`);
  }
});

test('un événement inconnu laisse l’état inchangé, donc masqué', () => {
  // Une machine qui tolère l'inconnu en restant masquée est préférable à une
  // machine qui s'ouvre par défaut.
  const inconnu = 'evenement_absent' as Parameters<typeof transiter>[1];
  assert.equal(transiter('masque', inconnu), 'masque');
});
