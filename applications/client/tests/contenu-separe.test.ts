// PREUVE — RG-61 : les libellés affichés vivent dans contenu/*.json, indexés
// par clés techniques neutres, et AUCUN texte de révélation n'est codé dans un
// composant.
//
// C'est ce qui permettra de trancher l'univers (ESC-01) sans toucher au serveur
// ni à un écran : il suffira de remplacer des VALEURS de contenu.
//
// Le test vérifie trois choses, et la troisième est la plus importante :
//  1. toutes les clés d'énumération du protocole ont un libellé non vide ;
//  2. toute clé employée par le code existe dans le fichier de contenu ;
//  3. la phrase du génie est COMPOSÉE, et les gabarits ne figurent nulle part
//     ailleurs que dans revelations.fr.json.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAUSE,
  CODES_ERREUR,
  ETAT_PARTIE,
  GABARIT,
  MISSION,
  MOTIF_MOUVEMENT,
  PHASE,
  ROLE,
  STATUT_PRET,
  TYPES_COMMANDE,
  VERDICT,
} from '@gdv/partage';

import {
  composerEcartTotal,
  composerRevelation,
  texte,
  texteExiste,
} from '../src/logique/contenu.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');

const ENUMERATIONS: readonly (readonly [string, readonly string[]])[] = [
  ['phase', PHASE],
  ['etat_partie', ETAT_PARTIE],
  ['role', ROLE],
  ['role_description', ROLE],
  ['mission', MISSION],
  ['mission_description', MISSION],
  ['clause', CLAUSE],
  ['clause_description', CLAUSE],
  ['gabarit', GABARIT],
  ['verdict', VERDICT],
  ['statut_pret', STATUT_PRET],
  ['motif_mouvement', MOTIF_MOUVEMENT],
  ['code_erreur', CODES_ERREUR],
  ['action', TYPES_COMMANDE],
];

test('chaque clé technique du protocole a un libellé NON VIDE', () => {
  const manquantes: string[] = [];
  for (const [section, valeurs] of ENUMERATIONS) {
    for (const valeur of valeurs) {
      if (!texteExiste(`${section}.${valeur}`)) manquantes.push(`${section}.${valeur}`);
    }
  }
  assert.deepEqual(manquantes, [], `libellés manquants : ${manquantes.join(', ')}`);
});

test('un message d’erreur dit QUOI FAIRE, et non seulement ce qui a échoué', () => {
  // Règle de rédaction opposable du contrat de conception. Approximation
  // mesurable : le message porte un verbe d'action à l'impératif ou une
  // consigne. Un diagnostic nu de trois mots ne passe pas.
  const trop_court: string[] = [];
  for (const code of CODES_ERREUR) {
    const message = texte(`code_erreur.${code}`);
    if (message.split(/\s+/u).length < 6) trop_court.push(`${code} → « ${message} »`);
  }
  assert.deepEqual(trop_court, [], `messages purement diagnostiques : ${trop_court.join(' | ')}`);
});

test('toute clé de contenu employée par le code existe réellement', () => {
  const fichiers = (racine: string): string[] => {
    const trouves: string[] = [];
    for (const entree of readdirSync(racine, { withFileTypes: true })) {
      const chemin = join(racine, entree.name);
      if (entree.isDirectory()) trouves.push(...fichiers(chemin));
      else if (entree.name.endsWith('.vue') || entree.name.endsWith('.ts')) trouves.push(chemin);
    }
    return trouves;
  };

  const absentes = new Set<string>();
  for (const absolu of fichiers(SOURCE)) {
    const contenu = readFileSync(absolu, 'utf8');
    // Seuls les appels à clé LITTÉRALE sont vérifiables statiquement ; les
    // clés construites (`role.${role}`) sont couvertes par le test des
    // énumérations ci-dessus.
    for (const trouve of contenu.matchAll(/texte\(\s*'([a-z0-9_.]+)'/gu)) {
      const cle = trouve[1] as string;
      if (!texteExiste(cle)) {
        absentes.add(`${relative(SOURCE, absolu).split('\\').join('/')} → ${cle}`);
      }
    }
  }
  assert.deepEqual([...absentes], [], `clés absentes : ${[...absentes].join(' | ')}`);
});

test('chaque gabarit de révélation porte au moins DEUX formulations (RG-25)', () => {
  const catalogue = JSON.parse(
    readFileSync(resolve(SOURCE, 'contenu', 'revelations.fr.json'), 'utf8'),
  ) as { variantes: Record<string, string[]> };

  for (const gabarit of GABARIT) {
    const variantes = catalogue.variantes[gabarit];
    assert.ok(Array.isArray(variantes), `gabarit ${gabarit} absent du catalogue`);
    assert.ok(
      (variantes as string[]).length >= 2,
      `gabarit ${gabarit} : ${(variantes as string[]).length} formulation(s), 2 au minimum`,
    );
  }
});

test('la phrase du génie est COMPOSÉE depuis le gabarit, la variante et les valeurs', () => {
  const phrase = composerRevelation(
    { gabarit: 'VOISINAGE', variante_formulation: 0, cibles: ['id-awa'], valeurs: {} },
    (identifiant) => (identifiant === 'id-awa' ? 'Awa' : identifiant),
  );
  assert.ok(phrase.includes('Awa'), `la cible doit être résolue en pseudo : « ${phrase} »`);
  assert.ok(!phrase.includes('{'), `aucun jeton non substitué : « ${phrase} »`);
  assert.ok(!phrase.includes('id-awa'), 'l’identifiant brut ne doit pas rester à l’écran');
});

test('les deux variantes d’un même gabarit donnent des phrases DIFFÉRENTES', () => {
  const avec = (variante: number): string =>
    composerRevelation(
      { gabarit: 'COMPTAGE', variante_formulation: variante, cibles: [], valeurs: { k: 2 } },
      (identifiant) => identifiant,
    );
  assert.notEqual(avec(0), avec(1));
});

test('l’accord grammatical vient du CONTENU, pas d’une règle codée', () => {
  const avec = (k: number): string =>
    composerRevelation(
      { gabarit: 'COMPTAGE', variante_formulation: 0, cibles: [], valeurs: { k } },
      (identifiant) => identifiant,
    );
  assert.ok(avec(1).includes('a menti'), `singulier attendu : « ${avec(1)} »`);
  assert.ok(avec(3).includes('ont menti'), `pluriel attendu : « ${avec(3)} »`);
});

test('un index de variante hors tableau se rabat sur 0, sans erreur', () => {
  const phrase = composerRevelation(
    { gabarit: 'PASSE', variante_formulation: 99, cibles: [], valeurs: {} },
    (identifiant) => identifiant,
  );
  assert.ok(phrase.length > 0 && !phrase.startsWith('⟦'));
});

test('l’écart total se compose aussi depuis le contenu', () => {
  const phrase = composerEcartTotal(20, 18);
  assert.ok(phrase.includes('20') && phrase.includes('18'), `« ${phrase} »`);
  assert.ok(!phrase.includes('{'));
});

test('AUCUN texte de révélation n’est codé dans un composant ou un écran', () => {
  const catalogue = JSON.parse(
    readFileSync(resolve(SOURCE, 'contenu', 'revelations.fr.json'), 'utf8'),
  ) as { variantes: Record<string, string[]> };

  // Fragment significatif de chaque formulation : s'il apparaît ailleurs que
  // dans le fichier de contenu, c'est qu'un texte a été recopié dans du code.
  const fragments: string[] = [];
  for (const variantes of Object.values(catalogue.variantes)) {
    for (const formulation of variantes) {
      const nu = formulation.replace(/\{[a-z_]+\}/gu, '').trim();
      if (nu.length >= 12) fragments.push(nu.slice(0, 12));
    }
  }

  const fichiers = (racine: string): string[] => {
    const trouves: string[] = [];
    for (const entree of readdirSync(racine, { withFileTypes: true })) {
      const chemin = join(racine, entree.name);
      if (entree.isDirectory()) trouves.push(...fichiers(chemin));
      else if (entree.name.endsWith('.vue') || entree.name.endsWith('.ts')) trouves.push(chemin);
    }
    return trouves;
  };

  const fautifs: string[] = [];
  for (const absolu of fichiers(SOURCE)) {
    const contenu = readFileSync(absolu, 'utf8');
    for (const fragment of fragments) {
      if (contenu.includes(fragment)) {
        fautifs.push(`${relative(SOURCE, absolu).split('\\').join('/')} → « ${fragment}… »`);
      }
    }
  }
  assert.deepEqual(fautifs, [], `texte de révélation codé en dur : ${fautifs.join(' | ')}`);
});

test('une clé absente est VISIBLE à l’écran, jamais un libellé vide', () => {
  const rendu = texte('section.inexistante');
  assert.equal(rendu, '⟦section.inexistante⟧');
});
