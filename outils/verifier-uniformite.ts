// =============================================================================
// PORTE DE QUALITÉ — verifier:uniformite (RG-80, ADR-TL-20, ARCHI 1.2.0)
// =============================================================================
// POURQUOI CETTE PORTE EXISTE. À l'audit du nœud S6, les NEUF portes étaient
// vertes — dont verifier:visibilite à 0 divergence sur 144 occurrences champ ×
// événement — et SIX canaux fuyaient. Aucune des six fuites ne passait par un
// champ. La porte de visibilité mesure la PRÉSENCE D'UN CHAMP : c'est son angle
// mort exact, et elle ne doit pas être étendue pour couvrir autre chose que ce
// qu'elle sait faire. Cette porte-ci mesure la FORME du trafic et ne regarde
// JAMAIS le contenu d'une charge — à une exception déclarée, le test P-c, qui
// compare des NOMS de clés et jamais des valeurs.
//
// LES CONTRÔLES, tels que l'ARCHI les prescrit :
//
//   U1a NOMBRE     le nombre de trames reçues est le même pour tous les joueurs
//                  d'une session, à effectif 6 puis 8, à graine fixée.
//   U1b SÉQUENCE   la suite des types est la même terme à terme pour tous, donc
//                  les numéros de séquence par session (RUP-01) sont égaux. Le
//                  contrôle le moins coûteux de la porte.
//   U1c TAILLE     les trames d'un même rang sont de même taille APRÈS
//                  remplissage. Mesure brute + présence du remplissage dans le
//                  transport : sans remplissage, l'écart brut EST l'écart réel
//                  sur le fil, TLS préservant les longueurs.
//   U2  DIFFÉRENTIEL  deux parties à graine identique ne différant que par un
//                  acte secret produisent le même profil de forme pour chaque
//                  joueur, l'ACTEUR COMPRIS : sa charge peut différer, sa forme
//                  non. Seul contrôle du dépôt dont les deux opérandes sont
//                  INDÉPENDANTS, donc le seul non tautologique (ADR-TL-24).
//   U3  STATIQUE   sur le seul contrat : x-emission partout, x-charge-neutre là
//                  où il est exigible, sous-ensemble des propriétés déclarées,
//                  et aucun champ de charge neutre rattaché à une donnée non
//                  publique par outils/visibilite/cartographie.mjs.
//   U4  EXCEPTIONS les types dont le code se dispense d'uniformité, MESURÉS,
//                  comparés à la liste FERMÉE du contrat.
//   P-c CLÉS       l'ensemble des clés émises est égal EXACTEMENT à la variante
//                  complète, à x-charge-neutre, ou à une variante déclarée. Un
//                  ensemble intermédiaire est un défaut bloquant.
//
// CE QUE CETTE PORTE NE DÉTECTE PAS, et il faut le lire avant de citer son
// verdict :
//   · la CADENCE. Elle ne mesure aucun instant : l'ARCHI ne rend pas exigible
//     en v1 une cadence indépendante des actes. Un observateur apprend qu'UN
//     acte a eu lieu à l'instant t, jamais lequel ni de qui.
//   · le résidu INTER-PALIER de etat_complet_prive, inscrit en dette assumée.
//   · les trames accuse_reception et erreur, MESURÉ ET DÉCLARÉ : le harnais
//     pilote le moteur sans id_correlation, donc aucune des deux n'est projetée
//     dans les scénarios — diagnostic vérifié, 14 types de trame sur 30 appa-
//     raissent. Or accuse_reception est l'UN DES TROIS contributeurs du profil
//     28 contre 25 de ANO-02. Cette porte ne couvre donc pas ce tiers-là, et le
//     dire vaut mieux que de laisser croire le contraire. Fermer la lacune
//     demande un harnais qui corrèle les commandes, ce qui appartient au nœud
//     QA et non à l'outillage.
//   · une asymétrie que le SCÉNARIO ne crée pas. U4 déduit les exceptions du
//     code d'une inégalité de dénombrement : si les N joueurs agissent tous,
//     dans le même ordre, le dénombrement redevient égal et seul U1d voit
//     encore quelque chose. paiement_enregistre en est l'exemple : il est émis
//     au seul payeur et son compte est pourtant [2,2,2,2,2,2].
//   · la signature du Dernier Vœu comme acte secret de U2 : elle exige le mode
//     avancé et un parcours DV complet. Lacune DÉCLARÉE, sept des huit actes de
//     la liste fermée sont couverts.
//   · l'exhaustivité sur les ÉTATS. Le harnais joue des scénarios, pas tous les
//     états possibles. Le test P-c en propriété (fast-check) sur états générés
//     reste dû par le nœud backend : cette porte en est le filet, pas le
//     substitut.
//
// Usage  : node --conditions=gdv-source --experimental-strip-types \
//            outils/verifier-uniformite.ts [--contrats <dossier>]
// Sortie : 0 = CONFORME, 1 = DIVERGENCE (porte fermée)
// =============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CARTOGRAPHIE, CHAMPS_NEUTRES } from './visibilite/cartographie.mjs';
import { EMISSIONS_CONNUES, lireContrat, type SchemaEvt } from './uniformite/contrat.ts';
import {
  controlerAlignement,
  controlerClesEmises,
  controlerDifferentiel,
  controlerNombre,
  controlerSequence,
  exceptionsDeFait,
  mesurerEcartsDeTaille,
  profils,
} from './uniformite/profil.ts';
import { pairesDifferentielles, partieComplete } from './uniformite/scenarios.ts';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (nom: string): string | null => {
  const index = process.argv.indexOf(nom);
  const valeur = process.argv[index + 1];
  return index !== -1 && valeur !== undefined ? valeur : null;
};
const DOSSIER_CONTRATS = resolve(
  argument('--contrats') ?? join(RACINE, '.claude', 'orchestration', 'contrats'),
);
const DOSSIER_TRANSPORT = join(RACINE, 'applications', 'serveur', 'src', 'temps-reel');

const anomalies: { controle: string; detail: string }[] = [];
const constats: string[] = [];
const signaler = (controle: string, detail: string): void => {
  anomalies.push({ controle, detail });
};

const contrat = lireContrat(DOSSIER_CONTRATS, signaler);

// --- U3 : statique, sur le seul contrat --------------------------------------

/** Un champ de charge neutre doit être public : sinon la neutralité est fausse. */
function champPublic(champ: string): boolean {
  if (Object.prototype.hasOwnProperty.call(CHAMPS_NEUTRES, champ)) return true;
  for (const carte of Object.values(CARTOGRAPHIE) as { champs?: string[] }[]) {
    if ((carte.champs ?? []).includes(champ)) return false;
  }
  return false;
}

function controlerSchemaStatique(schema: SchemaEvt): void {
  const regle = EMISSIONS_CONNUES[schema.emission];
  if (regle === undefined) {
    signaler(
      'U3',
      `${schema.nom} : x-emission = « ${schema.emission || 'absent'} » n’appartient pas au ` +
        `vocabulaire connu (${Object.keys(EMISSIONS_CONNUES).join(', ')}). Une annotation ` +
        `absente ou inventée est une émission que personne n’a décidée — c'était le défaut ` +
        `réel de l'API 1.1.0, neuf schémas sur trente sans annotation, que personne n'avait vu.`,
    );
    return;
  }
  if (regle.exigeChargeNeutre && schema.chargeNeutre === null) {
    signaler(
      'U3',
      `${schema.nom} : x-emission = « ${schema.emission} » mais x-charge-neutre est absent. ` +
        `required ne gouverne que la variante complète : sans x-charge-neutre, la charge des ` +
        `non-destinataires n’est gouvernée par RIEN et aucun validateur ne peut la contrôler.`,
    );
  }
  controlerChargeNeutre(schema);
  controlerVariantes(schema);
}

function controlerChargeNeutre(schema: SchemaEvt): void {
  for (const champ of schema.chargeNeutre ?? []) {
    if (!schema.proprietes.includes(champ)) {
      signaler(
        'U3',
        `${schema.nom} : x-charge-neutre cite « ${champ} », absent des propriétés déclarées.`,
      );
    }
    if (!champPublic(champ)) {
      signaler(
        'U3',
        `${schema.nom} : x-charge-neutre porte « ${champ} », qui n’est pas une donnée visible ` +
          `de tous selon outils/visibilite/cartographie.mjs. Une charge neutre qui porte un ` +
          `secret est une porte dérobée déclarée.`,
      );
    }
  }
}

function controlerVariantes(schema: SchemaEvt): void {
  for (const [nom, variante] of Object.entries(schema.variantes ?? {})) {
    for (const champ of variante) {
      if (schema.proprietes.includes(champ)) continue;
      signaler(
        'U3',
        `${schema.nom} : la variante « ${nom} » de x-charge-par-destinataire cite « ${champ} », ` +
          `absent des propriétés déclarées.`,
      );
    }
  }
}

for (const schema of contrat.schemas) controlerSchemaStatique(schema);
constats.push(
  `U3 — ${String(contrat.schemas.length)} schémas EvtXxx contrôlés sur le seul contrat ` +
    `(API ${contrat.version}) : annotation, charge neutre, variantes, publicité des champs neutres.`,
);

// --- U1 : profil de forme, effectif 6 puis 8 ---------------------------------

/**
 * Le remplissage par paliers est appliqué par le TRANSPORT, en dernier, juste
 * avant l'écriture sur le socket (RUP-03). Le harnais mesure la charge projetée
 * par le moteur : il ne peut donc pas constater un remplissage qui n'existe
 * pas. Cette sonde répond à « le transport complète-t-il ses trames ? ».
 */
function transportRemplitLesTrames(): boolean {
  for (const fichier of readdirSync(DOSSIER_TRANSPORT)) {
    if (!fichier.endsWith('.ts')) continue;
    if (/\bremplissage\b/u.test(readFileSync(join(DOSSIER_TRANSPORT, fichier), 'utf8'))) {
      return true;
    }
  }
  return false;
}

const REMPLISSAGE_PRESENT = transportRemplitLesTrames();
const deFait = new Set<string>();

for (const effectif of [6, 8]) {
  const banc = partieComplete(effectif);
  const mesures = profils(banc.trames, banc.joueurs);
  const etiquette = `U1 partie complète à ${String(effectif)} joueurs`;
  const nombre = controlerNombre(mesures, etiquette, signaler);
  const sequence = controlerSequence(mesures, etiquette, signaler);
  const alignement = controlerAlignement(mesures, etiquette, signaler);
  const tailles = mesurerEcartsDeTaille(mesures);
  if (!REMPLISSAGE_PRESENT) {
    signaler(
      'U1c',
      `${etiquette} — aucun remplissage de trame dans ${DOSSIER_TRANSPORT} : le champ ` +
        `EnveloppeEvenement.remplissage exigé par RUP-03 n'est produit par aucun module du ` +
        `transport. L'écart de taille brut est donc l'écart réel sur le fil, TLS préservant ` +
        `les longueurs. Mesure : ${String(tailles.rangs)} rang(s) de taille inégale, écart ` +
        `maximal ${String(tailles.ecartMax)} octets${tailles.exemple === null ? '' : ` (${tailles.exemple})`}.`,
    );
  } else if (tailles.rangs > 0) {
    signaler(
      'U1c',
      `${etiquette} — ${String(tailles.rangs)} rang(s) de taille inégale malgré un remplissage ` +
        `présent dans le transport, écart maximal ${String(tailles.ecartMax)} octets.`,
    );
  }
  for (const type of exceptionsDeFait(banc.trames, banc.joueurs)) deFait.add(type);
  constats.push(
    `U1 — ${String(effectif)} joueurs, ${String(banc.trames.length)} trames projetées ; ` +
      `nombre ${nombre ? 'uniforme' : 'NON uniforme'}, séquence ` +
      `${sequence ? 'alignée' : 'NON alignée'}, lots ${alignement ? 'groupés' : 'NON groupés'}, ` +
      `${String(tailles.rangs)} rang(s) de taille inégale.`,
  );
  const controlees = controlerClesEmises(banc.trames, contrat.parType, signaler);
  constats.push(
    `P-c — ${String(controlees)} charges projetées confrontées aux variantes déclarées ` +
      `(effectif ${String(effectif)}).`,
  );
}

// --- U2 : invariance différentielle ------------------------------------------

let pairesConformes = 0;
const paires = pairesDifferentielles();
for (const paire of paires) {
  const conforme = controlerDifferentiel(
    profils(paire.a.trames, paire.a.joueurs),
    profils(paire.b.trames, paire.b.joueurs),
    paire.etiquette,
    signaler,
  );
  if (conforme) pairesConformes += 1;
}
constats.push(
  `U2 — ${String(pairesConformes)}/${String(paires.length)} paires différentielles invariantes ` +
    `(acteur compris). Actes couverts : paiement, enquête, transfert, rôles, porteur de clause, ` +
    `prêt proposé, réponse au prêt.`,
);

// --- U4 : exceptions fermées -------------------------------------------------

for (const type of deFait) {
  if (contrat.exceptions.has(type)) continue;
  signaler(
    'U4',
    `le type « ${type} » n’est PAS émis au même nombre à tous les destinataires, et il ne ` +
      `figure pas dans la liste fermée des exceptions du contrat. C'est une exception que le ` +
      `CODE s'accorde sans décision d'architecture.`,
  );
}
for (const declaree of contrat.exceptions) {
  if (deFait.has(declaree)) continue;
  constats.push(
    `U4 — l’exception déclarée « ${declaree} » n’est pas exercée par le code sur ces ` +
      `scénarios : rien à comparer, aucune conclusion tirée.`,
  );
}
constats.push(
  `U4 — ${String(deFait.size)} type(s) non uniformes mesurés dans le code, ` +
    `${String(contrat.exceptions.size)} exception(s) déclarées au contrat.`,
);

// --- Verdict -----------------------------------------------------------------

const verdict = anomalies.length === 0 ? 'CONFORME' : 'DIVERGENCE';
const parControle = new Map<string, number>();
for (const { controle } of anomalies) {
  parControle.set(controle, (parControle.get(controle) ?? 0) + 1);
}

console.log('PORTE — uniformité de forme : RG-80 / API x-emission (ADR-TL-20)');
console.log(`  contrats : ${DOSSIER_CONTRATS}`);
console.log(`  transport : ${DOSSIER_TRANSPORT} — remplissage ${REMPLISSAGE_PRESENT ? 'présent' : 'ABSENT'}`);
console.log('-'.repeat(78));
// « mes. » et non « ok » : un constat est une MESURE, pas un succes. Afficher
  // « ok 0 route sur 6 » serait un mensonge de presentation.
  for (const constat of constats) console.log(`  mes. ${constat}`);
if (anomalies.length > 0) {
  console.log('');
  for (const { controle, detail } of anomalies) console.log(`  ÉCHEC [${controle}] ${detail}`);
  console.log('');
  console.log(
    `  bilan par contrôle : ${[...parControle]
      .map(([controle, nombre]) => `${controle}=${String(nombre)}`)
      .join(', ')}`,
  );
}
console.log('-'.repeat(78));
console.log(`VERDICT ${verdict} — ${String(anomalies.length)} divergence(s)`);

process.exit(anomalies.length === 0 ? 0 : 1);
