#!/usr/bin/env node
// =============================================================================
// PORTE DE QUALITÉ — cohérence x-visibilite (API) ↔ matrice_visibilite (SPEC)
// =============================================================================
// Exigée nommément par ARCHI-GDV-001.json :
//   seuils_qualite.interdits_mecaniques — « x-visibilite de chaque EvtXxx est
//   cohérent avec matrice_visibilite de la SPEC ; outils/verifier-visibilite.mjs
//   échoue sinon » — empêche « une dérive silencieuse entre le contrat et la
//   règle métier ».
//
// Ce que l'outil rend vérifiable MÉCANIQUEMENT, et non déclarativement :
//
//   P1  Chaque schéma EvtXxx porte x-visibilite, x-destinataires et
//       x-justification-visibilite. Une annotation absente = porte fermée.
//   P2  La valeur de x-visibilite appartient aux classes déclarées dans
//       API x-temps-reel.classes_de_destinataire.
//   P3  Chaque entrée de matrice_visibilite est cartographiée vers des champs du
//       protocole, et toute cartographie correspond à une entrée existante. Une
//       entrée ajoutée à la SPEC et non câblée ferme la porte : un rapport qui ne
//       mesure pas la nouvelle règle ne prouve rien.
//   P4  Aucun champ dont la donnée n'est pas « visible_par: tous » n'apparaît dans
//       un événement de classe « tous », sauf si cet événement est l'événement de
//       PUBLICATION déclaré par devient_public pour cette donnée.
//       C'est le cœur de RG-01 : la classe « tous » part vers les huit téléphones.
//   P5  Une donnée dont aucune classe de destinataire n'est autorisée (visible_par
//       = serveur seul) n'apparaît dans AUCUN événement, à aucune classe.
//   P6  Une donnée restreinte à une classe précise (enquêteur, porteur, hôte)
//       n'apparaît que dans des événements de cette classe.
//   P7  Tout champ présent dans un EvtXxx est classé : soit rattaché à une entrée
//       de matrice_visibilite, soit inscrit dans CHAMPS_NEUTRES avec son motif. Un
//       champ AJOUTÉ PLUS TARD au contrat et non classé ferme la porte — c'est ce
//       contrôle qui attrape la fuite introduite par un champ nouveau.
//   P8  L'énumération EnveloppeEvenement.type correspond exactement, un pour un,
//       aux noms de schémas EvtXxx (ARCHI standards.nommage_messages).
//
// GRANULARITÉ : un champ se déclare par son nom seul (« montant_paye » : même sens
// partout) ou qualifié par le schéma qui le porte (« MouvementPiece.motif ») quand
// deux schémas emploient le même nom pour deux données différentes. La forme
// qualifiée gagne sur la forme nue.
//
// EXEMPTION, UNE SEULE, DÉCLARÉE : EvtEtatCompletPrive est la RE-PROJECTION
// COMPLÈTE d'un joueur (RG-73) ; par construction il contient tout ce que ce
// destinataire — et lui seul — a le droit de voir. Il est donc exempté de P6.
// Contrepartie vérifiée : sa classe doit être exactement « proprietaire ». Si
// quelqu'un la passait à « tous », l'exemption tomberait et P4 fermerait.
//
// Usage  : node outils/verifier-visibilite.mjs [--contrats <dossier>] [--json <fichier>]
//          --contrats sert à éprouver la porte sur une COPIE volontairement
//          corrompue : les contrats réels ne sont jamais modifiés pour un test.
// Sortie : 0 = CONFORME, 1 = DIVERGENCE (porte fermée)
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLASSES_CONNUES } from './visibilite/cartographie.mjs';
import { construireEvenements, construireIndexChamps } from './visibilite/inventaire.mjs';
import {
  controlerAnnotations,
  controlerChampsParClasse,
  controlerClassification,
  controlerEnumerationTypes,
  controlerExemptionReprojection,
} from './visibilite/controles.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (nom) => {
  const index = process.argv.indexOf(nom);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : null;
};
const DOSSIER_CONTRATS = resolve(
  argument('--contrats') ?? join(RACINE, '.claude', 'orchestration', 'contrats'),
);

const anomalies = [];
const constats = [];
const signaler = (porte, detail) => anomalies.push({ porte, detail });

function abandonner(message) {
  console.error(`ÉCHEC — ${message}`);
  process.exit(1);
}

function lireContrat(nomFichier) {
  const chemin = join(DOSSIER_CONTRATS, nomFichier);
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    return abandonner(`${nomFichier} illisible : ${chemin}\n  ${erreur.message}`);
  }
}

const api = lireContrat('API-GDV-001.json');
const spec = lireContrat('SPEC-GDV-001.json');

const schemas = api?.components?.schemas ?? {};
const nomsEvt = Object.keys(schemas).filter((nom) => nom.startsWith('Evt'));
if (nomsEvt.length === 0) {
  abandonner('aucun schéma EvtXxx trouvé : le contrat ne décrit rien à vérifier.');
}

const classesDeclarees = Object.keys(api?.['x-temps-reel']?.classes_de_destinataire ?? {}).filter(
  (cle) => !cle.startsWith('_'),
);
if (classesDeclarees.length === 0) {
  abandonner('x-temps-reel.classes_de_destinataire absent de l’API.');
}
for (const classe of classesDeclarees) {
  if (!CLASSES_CONNUES.includes(classe)) {
    signaler(
      'P2',
      `classe de destinataire « ${classe} » déclarée dans l’API mais inconnue de l’outil : ` +
        `la traduction vers matrice_visibilite n’est pas définie, donc rien n’est vérifié ` +
        `pour elle.`,
    );
  }
}

const entrees = spec?.matrice_visibilite?.entrees;
if (!Array.isArray(entrees) || entrees.length === 0) {
  abandonner('SPEC matrice_visibilite.entrees absent ou vide.');
}

const evenements = construireEvenements(schemas, nomsEvt);
const { index, donnees } = construireIndexChamps(entrees, nomsEvt, signaler);

constats.push(controlerAnnotations(evenements, classesDeclarees, signaler));
controlerExemptionReprojection(evenements, signaler);
constats.push(`P3 — ${entrees.length} entrées de matrice_visibilite, toutes cartographiées.`);
constats.push(controlerChampsParClasse(evenements, index, signaler));
constats.push(controlerClassification(evenements, index, signaler));
const constatP8 = controlerEnumerationTypes(schemas, nomsEvt, signaler);
if (constatP8) constats.push(constatP8);

// --- Verdict ----------------------------------------------------------------
const verdict = anomalies.length === 0 ? 'CONFORME' : 'DIVERGENCE';

console.log('PORTE — visibilité : x-visibilite (API-GDV-001) ↔ matrice_visibilite (SPEC-GDV-001)');
console.log(`  contrats : ${DOSSIER_CONTRATS}`);
console.log('-'.repeat(78));
for (const constat of constats) console.log(`  ok   ${constat}`);
if (anomalies.length > 0) {
  console.log('');
  for (const { porte, detail } of anomalies) console.log(`  ÉCHEC [${porte}] ${detail}`);
}
console.log('-'.repeat(78));
console.log(`VERDICT ${verdict} — ${anomalies.length} divergence(s)`);

const cheminJson = argument('--json');
if (cheminJson) {
  const cible = resolve(cheminJson);
  mkdirSync(dirname(cible), { recursive: true });
  const rapport = {
    porte: 'visibilite',
    verdict,
    api: { fichier: 'API-GDV-001.json', version: api?.info?.version ?? null },
    spec: { fichier: 'SPEC-GDV-001.json', version: spec?.version ?? null },
    evenements: evenements.map(({ nom, classe }) => ({ nom, classe })),
    donnees,
    constats,
    anomalies,
  };
  writeFileSync(cible, `${JSON.stringify(rapport, null, 2)}\n`, 'utf8');
  console.log(`rapport : ${cible}`);
}

process.exit(anomalies.length === 0 ? 0 : 1);
