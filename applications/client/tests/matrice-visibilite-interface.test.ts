// PREUVE — aucun écran n'affiche une donnée que matrice_visibilite interdit à
// son destinataire.
//
// Le serveur ne livre à un appareil que ce que son porteur a le droit de voir :
// cette moitié est prouvée côté backend. La moitié restante est ici — ne pas
// sortir d'un VOILE une donnée qui doit y rester, et ne pas laisser une donnée
// secrète atteindre une zone publique par construction (mesure M6).
//
// Le test est STRUCTUREL : il lit les sources. Un test de rendu exigerait un
// DOM, que ce projet n'embarque pas ; une lecture de source attrape la même
// classe de faute — un nom de champ secret cité dans un composant public.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ICI, '..', 'src');
const lire = (...segments: string[]): string => readFileSync(resolve(SOURCE, ...segments), 'utf8');
const relatif = (absolu: string): string => relative(SOURCE, absolu).split('\\').join('/');

/**
 * Retire les commentaires avant toute analyse.
 *
 * Sans cela, le test se déclenche sur les commentaires qui NOMMENT la règle
 * qu'ils protègent — « v-if et non v-show », « l'identité du porteur » — et
 * punit la documentation au lieu du code. Un test qui pousse à ne plus écrire
 * pourquoi une règle existe est un test nuisible.
 */
function sansCommentaires(source: string): string {
  return source
    .replaceAll(/<!--[\s\S]*?-->/gu, ' ')
    .replaceAll(/\/\*[\s\S]*?\*\//gu, ' ')
    .replaceAll(/^\s*\/\/.*$/gmu, ' ');
}

function fichiers(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiers(chemin));
    else if (entree.name.endsWith('.vue')) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Zones déclarées PUBLIQUES PAR CONSTRUCTION par le contrat de conception
 * (mesure M6). Leur contrat d'entrée ne doit accepter aucune donnée secrète.
 */
const ZONES_PUBLIQUES = [
  'composants/BandeauPhase.vue',
  'composants/BandeauAlerte.vue',
  'composants/CarteJoueurCercle.vue',
  'composants/ListeDeclarationsPubliques.vue',
  'composants/JetonMontant.vue',
  'composants/IndicateurConnexion.vue',
];

/** Champs dont matrice_visibilite réserve la lecture au seul propriétaire. */
const CHAMPS_SECRETS = [
  'montant_paye',
  'solde_pieces',
  'role_secret',
  'mission_secrete',
  'clause_connue',
  'ma_signature_dernier_voeu',
  'mes_enquetes_de_la_manche',
];

test('aucune zone publique ne déclare un champ secret en entrée', () => {
  const fautifs: string[] = [];
  for (const zone of ZONES_PUBLIQUES) {
    const contenu = lire(...zone.split('/'));
    const props = contenu.slice(contenu.indexOf('interface Props'), contenu.indexOf('</script>'));
    for (const champ of CHAMPS_SECRETS) {
      if (props.includes(champ)) fautifs.push(`${zone} → ${champ}`);
    }
  }
  assert.deepEqual(fautifs, [], `champ secret en zone publique : ${fautifs.join(' | ')}`);
});

test('la carte de joueur n’a AUCUNE entrée pour une enquête subie (M8, RG-27)', () => {
  const carte = lire('composants', 'CarteJoueurCercle.vue');
  for (const interdit of ['enquete', 'enquetes_subies', 'a_ete_enquete']) {
    assert.ok(
      !carte.includes(interdit),
      `${interdit} : la cible d'une enquête ne reçoit AUCUN signal, c'est ce qui rend le chantage possible`,
    );
  }
});

test('la carte de joueur ne porte aucune donnée privée d’autrui', () => {
  const carte = lire('composants', 'CarteJoueurCercle.vue');
  const props = carte.slice(carte.indexOf('interface Props'), carte.indexOf('const props'));
  // Seul le montant DÉCLARÉ est admis : il est public dès la soumission.
  assert.ok(props.includes('montantDeclare'), 'le montant déclaré est public, il doit figurer');
  assert.ok(!props.includes('montantPaye'), 'le montant payé ne doit jamais atteindre une carte');
  assert.ok(!props.includes('solde'), 'le solde d’autrui ne doit jamais atteindre une carte');
});

/**
 * Seule exception, et elle est la DÉFINITION d'un écran : aux scores finaux,
 * tout sort (RG-58). C'est le seul moment du jeu où aucun voile ne s'applique.
 */
const SANS_VOILE_PAR_CONTRAT = ['composants/TableauScores.vue'];

test('tout affichage de solde, de rôle ou de mission passe par un VoileSecret', () => {
  const fautifs: string[] = [];
  for (const absolu of fichiers(SOURCE)) {
    if (SANS_VOILE_PAR_CONTRAT.includes(relatif(absolu))) continue;
    const contenu = sansCommentaires(readFileSync(absolu, 'utf8'));
    const gabarit = contenu.slice(
      contenu.indexOf('<template>'),
      contenu.lastIndexOf('</template>'),
    );
    if (!/solde_pieces|role_secret|mission_secrete|montant_paye/u.test(gabarit)) continue;
    if (!contenu.includes('VoileSecret')) fautifs.push(relatif(absolu));
  }
  assert.deepEqual(fautifs, [], `donnée secrète affichée hors voile : ${fautifs.join(' | ')}`);
});

test('le voile retire le contenu secret de l’ARBRE, pas seulement de l’écran', () => {
  // v-show laisserait le texte dans le DOM, lisible par inspection et par un
  // lecteur d'écran. Seul v-if le retire.
  const voile = sansCommentaires(lire('composants', 'VoileSecret.vue'));
  assert.ok(!/v-show/u.test(voile), 'v-show est interdit : il laisse le secret dans l’arbre');
  assert.ok(/v-else-if="revele"/u.test(voile), 'la fenêtre doit être conditionnée par v-if');
});

test('aucune valeur secrète ne part dans un title ni dans un aria-label', () => {
  const voile = lire('composants', 'VoileSecret.vue');
  const gabarit = voile.slice(voile.indexOf('<template>'), voile.lastIndexOf('</template>'));
  for (const correspondance of gabarit.matchAll(/(?:title|aria-label)="([^"]*)"/gu)) {
    const valeur = correspondance[1] as string;
    assert.ok(
      !valeur.includes('secret') || valeur.includes('texte('),
      `attribut suspect : ${valeur}`,
    );
  }
  assert.ok(!gabarit.includes('type="hidden"'), 'aucun champ caché ne porte un secret');
});

test('le remasquage est câblé sur les CINQ causes de la mesure M3', () => {
  const voile = lire('composants', 'VoileSecret.vue');
  for (const cause of ['blur', 'scroll', 'visibilitychange', 'pointerup', 'clePhase']) {
    assert.ok(voile.includes(cause), `cause de remasquage absente : ${cause}`);
  }
});

test('aucun retour haptique ni sonore n’est déclenché par une révélation', () => {
  const fautifs: string[] = [];
  for (const absolu of fichiers(SOURCE)) {
    const contenu = readFileSync(absolu, 'utf8');
    // Un voisin entendrait la vibration ou le son.
    if (/navigator\.vibrate|new Audio\(|\.play\(\)/u.test(contenu)) fautifs.push(relatif(absolu));
  }
  assert.deepEqual(fautifs, [], `retour sensible interdit : ${fautifs.join(' | ')}`);
});

test('l’écran de scores est le SEUL sans voile, et il n’expose pas les exclusions permanentes', () => {
  const scores = sansCommentaires(lire('composants', 'TableauScores.vue'));
  assert.ok(!scores.includes('VoileSecret'), 'aux scores, tout sort : aucun voile');
  // Les deux exclusions permanentes de matrice_visibilite (CONF-04).
  assert.ok(!scores.includes('porteur'), 'l’identité du porteur de clause ne sort JAMAIS');
  assert.ok(!scores.includes('enquete'), 'l’existence des enquêtes ne sort JAMAIS');
});

test('l’écran d’abandon ne révèle rien (RG-76, CONF-05)', () => {
  const abandon = lire('vues', 'EcranPartieAbandonnee.vue');
  for (const interdit of ['role_secret', 'mission_secrete', 'montant_paye', 'TableauScores']) {
    assert.ok(
      !abandon.includes(interdit),
      `${interdit} : révéler sur abandon donnerait à l'hôte un moyen de forcer la divulgation`,
    );
  }
});

test('le message d’accès refusé est UNIFORME, quel que soit le motif', () => {
  // Distinguer « jeton expiré » de « jeton inconnu » confirmerait l'existence
  // d'une session ou d'un joueur à un client modifié. L'analyse porte donc sur
  // les CLÉS DE CONTENU employées, qui sont ce que le joueur lit.
  const refus = sansCommentaires(lire('vues', 'EcranAccesRefuse.vue'));
  const cles = [...refus.matchAll(/texte\(\s*'([a-z0-9_.]+)'/gu)].map((t) => t[1] as string);
  const divulgantes = cles.filter((cle) => /expire|inconnu|usurp|jeton/u.test(cle));
  assert.deepEqual(divulgantes, [], `clé divulgant le motif : ${divulgantes.join(', ')}`);
  assert.ok(cles.includes('ecran.acces_refuse.message'), 'message uniforme attendu');

  const message = JSON.parse(lire('contenu', 'fr.json')) as {
    ecran: { acces_refuse: { message: string } };
  };
  for (const mot of ['expir', 'inconnu', 'usurp', 'invalide']) {
    assert.ok(
      !message.ecran.acces_refuse.message.toLowerCase().includes(mot),
      `le message affiché nomme le motif : « ${mot} »`,
    );
  }
});
