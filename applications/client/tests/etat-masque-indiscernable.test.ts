// PREUVE — RG-77 : les états SECRETS MASQUÉS sont indiscernables entre joueurs.
//
// Le serveur est étanche. Le canal de fuite qu'il ne couvre pas est physique :
// huit joueurs assis en cercle voient les écrans de leurs voisins. Un écran
// dont la DISPOSITION diffère selon l'information détenue trahit son porteur.
//
// Deux obligations, deux moitiés de test :
//  (a) la carte du pli du génie est rendue INCONDITIONNELLEMENT, chez tous, et
//      aucun élément de l'écran de vœu n'est conditionné par la réception ;
//  (b) la position des options du Dernier Vœu est tirée au hasard, localement,
//      indépendamment pour chaque joueur, et JAMAIS demandée au serveur.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { TYPES_COMMANDE } from '@gdv/partage';

import {
  clePourPartie,
  dispositionStable,
  OPTIONS_SIGNATURE,
  tirerDisposition,
  type StockageSimple,
} from '../src/logique/positions-signature.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');
const lire = (...segments: string[]): string => readFileSync(resolve(SOURCE, ...segments), 'utf8');

function memoire(): StockageSimple & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: (cle) => contenu.get(cle) ?? null,
    setItem: (cle, valeur) => void contenu.set(cle, valeur),
  };
}

// --- M7-a : la carte de pli est inconditionnelle ------------------------------

test('M7-a — la carte du pli est rendue sans condition sur la clause reçue', () => {
  const ecran = lire('vues', 'EcranAnnonceVoeu.vue');
  const balise = ecran.slice(ecran.indexOf('<VoileSecret'), ecran.indexOf('</VoileSecret>'));
  assert.ok(balise.length > 0, 'la carte de pli doit exister sur l’écran de vœu');
  assert.ok(
    !/v-if/u.test(balise.split('<template #secret>')[0] as string),
    'aucun v-if ne doit conditionner la PRÉSENCE de la carte de pli',
  );
});

test('M7-c — aucun élément de l’écran de vœu n’est conditionné par `clause`', () => {
  const ecran = lire('vues', 'EcranAnnonceVoeu.vue');
  const gabarit = ecran.slice(ecran.indexOf('<template>'), ecran.indexOf('</template>'));
  const conditions = [...gabarit.matchAll(/v-(?:if|else-if|show)="([^"]*)"/gu)].map(
    (trouve) => trouve[1] as string,
  );
  const fautives = conditions.filter((condition) => condition.includes('clause'));
  assert.deepEqual(
    fautives,
    [],
    `un badge, un compteur ou un libellé conditionné par la clause désignerait le porteur : ${fautives.join(' | ')}`,
  );
});

test('M7-a — le pli affiche un CONTENU quand aucune clause n’a été confiée', () => {
  const ecran = lire('vues', 'EcranAnnonceVoeu.vue');
  assert.ok(
    ecran.includes("texte('ecran.voeu.aucun_pli')"),
    'un joueur non destinataire doit lire « Aucun pli ne t’a été confié », jamais un vide',
  );
  const contenu = JSON.parse(lire('contenu', 'fr.json')) as {
    ecran: { voeu: { aucun_pli: string } };
  };
  assert.ok(contenu.ecran.voeu.aucun_pli.length > 0, 'le libellé doit exister dans le contenu');
});

test('M7-c — la feuille du pli ne porte qu’UNE carte, destinataire ou non', () => {
  const feuille = lire('vues', 'EcranPliGenie.vue');
  const occurrences = feuille.split('<VoileSecret').length - 1;
  assert.equal(
    occurrences,
    1,
    'un second voile présent seulement chez le destinataire se compte à l’œil nu',
  );
});

// --- M7-b : positions tirées au hasard, localement ----------------------------

test('M7-b — le tirage rend les deux ordres, et seulement eux', () => {
  assert.deepEqual([...tirerDisposition(() => 0)], ['signer', 'refuser']);
  assert.deepEqual([...tirerDisposition(() => 0.99)], ['refuser', 'signer']);
  assert.deepEqual([...OPTIONS_SIGNATURE], ['signer', 'refuser']);
});

test('M7-b — le tirage est ÉQUILIBRÉ : ni biais, ni ordre privilégié', () => {
  let direct = 0;
  const tirages = 2000;
  for (let index = 0; index < tirages; index += 1) {
    if (tirerDisposition(Math.random)[0] === 'signer') direct += 1;
  }
  const ecart = Math.abs(direct / tirages - 0.5);
  assert.ok(ecart < 0.06, `biais mesuré de ${(ecart * 100).toFixed(1)} points`);
});

test('M7-b — deux joueurs de la MÊME partie reçoivent des tirages indépendants', () => {
  const stockage = memoire();
  // Deux joueurs, deux sources d'aléa opposées : les dispositions diffèrent,
  // et chacune est mémorisée sous sa propre clé.
  const joueurA = dispositionStable(stockage, 'session-1', 'joueur-A', () => 0.1);
  const joueurB = dispositionStable(stockage, 'session-1', 'joueur-B', () => 0.9);

  assert.notDeepEqual([...joueurA], [...joueurB]);
  assert.ok(stockage.contenu.has(clePourPartie('session-1', 'joueur-A')));
  assert.ok(stockage.contenu.has(clePourPartie('session-1', 'joueur-B')));
});

test('M7-b — la disposition est STABLE pendant la partie', () => {
  const stockage = memoire();
  const premiere = dispositionStable(stockage, 'session-1', 'joueur-A', () => 0.1);
  // Un second appel avec un aléa OPPOSÉ doit rendre la valeur mémorisée : les
  // pastilles ne sautent pas sous le pouce pendant une fenêtre de 10 s.
  const seconde = dispositionStable(stockage, 'session-1', 'joueur-A', () => 0.9);
  assert.deepEqual([...premiere], [...seconde]);
});

test('M7-b — la mémorisation ne contient AUCUN choix, seulement un ordre', () => {
  const stockage = memoire();
  dispositionStable(stockage, 'session-1', 'joueur-A', () => 0.1);
  const memorise = stockage.contenu.get(clePourPartie('session-1', 'joueur-A')) as string;
  assert.equal(memorise, 'signer,refuser');
  // Un appareil prêté ne révèle donc rien : l'ordre d'affichage n'est pas un vote.
  assert.ok(!memorise.includes('true') && !memorise.includes('false'));
});

test('M7-b — une valeur mémorisée corrompue est retirée, pas interprétée', () => {
  const stockage = memoire();
  stockage.setItem(clePourPartie('s', 'j'), 'nimporte-quoi');
  const disposition = dispositionStable(stockage, 's', 'j', () => 0.1);
  assert.deepEqual([...disposition], ['signer', 'refuser']);
});

test('M7-b — aucune commande du protocole ne porte une position d’option', () => {
  // Demander la position au serveur l'inscrirait au journal de commandes, donc
  // dans un état rejouable, et la rendrait déductible. Le contrat n'offre
  // aucune commande pour cela, et le client n'en invente pas.
  const module = lire('logique', 'positions-signature.ts');
  for (const commande of TYPES_COMMANDE) {
    if (commande === 'signer_dernier_voeu') continue;
    assert.ok(!module.includes(`'${commande}'`), `${commande} n’a rien à faire ici`);
  }
  assert.ok(!module.includes('envoyer('), 'le tirage ne doit émettre aucune commande');
  assert.ok(!module.includes('fetch('), 'le tirage ne doit faire aucun appel réseau');
});

test('M7-b — l’écran de signature rend les deux options dans l’ordre TIRÉ', () => {
  const ecran = lire('vues', 'EcranDvSignature.vue');
  assert.ok(
    /v-for="option in disposition"/u.test(ecran),
    'les options doivent être rendues par itération sur la disposition tirée',
  );
  assert.ok(
    ecran.includes('dispositionStable('),
    'l’écran doit employer la disposition stable, pas un ordre fixe',
  );
});
