// =============================================================================
// PORTE DE QUALITÉ — verifier:routes (ADR-TL-23, ARCHI 1.2.0)
// =============================================================================
// Exigée nommément par ARCHI-GDV-001.json / seuils_qualite :
//   « Les chemins réellement enregistrés par le serveur, PRÉFIXE COMPRIS,
//     doivent former un ensemble ÉGAL aux six chemins de paths de
//     API-GDV-001.json préfixés par /api. Attendu : 6 sur 6. Second contrôle
//     dans la même porte : aucune réécriture de préfixe ne doit figurer dans la
//     configuration du proxy de développement du client. »
//
// POURQUOI DEUX CONTRÔLES ET NON UN. L'écart (ANO-11, mesuré à 0 route sur 6)
// a survécu à deux nœuds et à un arbitrage parce qu'il était MASQUÉ en
// développement par la réécriture /^\/api/ → '' du proxy Vite : invisible en
// développement, total en production. Préfixer le serveur SANS retirer la
// réécriture inverse simplement le défaut — le développement casse, la
// production marche — et laisse deux sources de vérité pour le préfixe. Les
// deux contrôles vont donc ensemble, dans la même porte, et R2 est le plus
// important des deux.
//
// COMMENT R1 MESURE. On construit l'instance Fastify par creerServeur() et on
// lit sa TABLE DE ROUTES après ready(). Aucune écoute de socket : la porte
// s'exécute serveurs de développement arrêtés, et ne peut donc pas entrer en
// conflit de port sur une machine partagée. Le service est un objet FACTICE :
// seules les DÉCLARATIONS de route sont mesurées, aucun gestionnaire n'est
// exécuté. Sans service, trois des six routes ne s'enregistrent même pas — et
// la porte mesurerait alors une configuration dégradée au lieu du dépôt.
//
// LES DEUX OPÉRANDES SONT INDÉPENDANTS (critère d'admission ADR-TL-24) : la
// valeur mesurée vient du CODE du serveur, le seuil vient du CONTRAT. Ce n'est
// pas un contrôle de cohérence de contrat.
//
// Usage  : node --conditions=gdv-source --experimental-strip-types \
//            outils/verifier-routes.ts [--contrats <dossier>] [--client <fichier>]
// Sortie : 0 = CONFORME, 1 = DIVERGENCE (porte fermée)
// =============================================================================

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { creerServeur } from '@gdv/serveur/http/serveur';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argument(nom: string): string | null {
  const index = process.argv.indexOf(nom);
  const valeur = process.argv[index + 1];
  return index !== -1 && valeur !== undefined ? valeur : null;
}

const DOSSIER_CONTRATS = resolve(
  argument('--contrats') ?? join(RACINE, '.claude', 'orchestration', 'contrats'),
);
const FICHIER_CLIENT = resolve(
  argument('--client') ?? join(RACINE, 'applications', 'client', 'vite.config.ts'),
);

const anomalies: { controle: string; detail: string }[] = [];
const constats: string[] = [];
const signaler = (controle: string, detail: string): void => {
  anomalies.push({ controle, detail });
};

function abandonner(message: string): never {
  console.error(`ÉCHEC — ${message}`);
  process.exit(1);
}

// --- Le contrat : six chemins, un préfixe ------------------------------------

interface ContratApi {
  readonly info?: { readonly version?: string };
  readonly servers?: readonly { readonly url?: string }[];
  readonly paths?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

const METHODES = ['get', 'post', 'put', 'patch', 'delete'] as const;

let api: ContratApi;
try {
  api = JSON.parse(readFileSync(join(DOSSIER_CONTRATS, 'API-GDV-001.json'), 'utf8')) as ContratApi;
} catch (erreur) {
  abandonner(`API-GDV-001.json illisible dans ${DOSSIER_CONTRATS} : ${String(erreur)}`);
}

/**
 * Le préfixe n'est PAS écrit en dur ici : il est lu dans servers[].url du
 * contrat. Un préfixe codé dans l'outil créerait la troisième source de vérité
 * que ADR-TL-23 cherche justement à supprimer.
 */
function prefixeDuContrat(): string {
  const url = api.servers?.[0]?.url;
  if (typeof url !== 'string' || url === '') {
    abandonner('API-GDV-001.json / servers[0].url absent : le préfixe REST est indéterminable.');
  }
  const chemin = url.replace(/^[a-z]+:\/\/[^/]*/u, '');
  return chemin.replace(/\/$/u, '');
}

const PREFIXE = prefixeDuContrat();

/** `/sessions/{code_adhesion}/apercu` → `/api/sessions/:code_adhesion/apercu` */
const normaliser = (chemin: string): string =>
  `${PREFIXE}${chemin}`.replace(/\{([^}]+)\}/gu, ':$1');

const attendues = new Set<string>();
for (const [chemin, operations] of Object.entries(api.paths ?? {})) {
  for (const methode of METHODES) {
    if (operations[methode] !== undefined) {
      attendues.add(`${methode.toUpperCase()} ${normaliser(chemin)}`);
    }
  }
}
if (attendues.size === 0) {
  abandonner('API-GDV-001.json / paths ne déclare aucune opération : rien à vérifier.');
}

// --- R1 : la table de routes réellement enregistrée --------------------------

/**
 * printRoutes rend un arbre : les enfants portent un chemin RELATIF au parent.
 * On reconstitue les chemins absolus par la profondeur d'indentation, qui est
 * de quatre caractères par niveau.
 */
interface Noeud {
  readonly niveau: number;
  readonly segment: string;
  readonly methodes: readonly string[];
}

const LARGEUR_NIVEAU = 4;

/**
 * HEAD est ajouté d'office par Fastify à côté de chaque GET : le contrat ne le
 * déclare pas et il ne constitue pas une route de plus.
 */
function lireMethodes(liste: string): readonly string[] {
  return liste
    .split(',')
    .map((methode) => methode.trim())
    .filter((methode) => methode !== '' && methode !== 'HEAD');
}

function lireNoeud(ligne: string): Noeud | null {
  const noeud = /^(?<marge>(?:[│ ]\s{3})*)[├└]──\s(?<reste>.*)$/u.exec(ligne);
  const groupes = noeud?.groups;
  if (groupes === undefined) return null;
  const reste = String(groupes.reste);
  const detail = /^(?<segment>.*?)\s\((?<methodes>[A-Z, ]+)\)\s*$/u.exec(reste)?.groups;
  return {
    niveau: String(groupes.marge).length / LARGEUR_NIVEAU,
    segment: detail === undefined ? reste.trimEnd() : String(detail.segment),
    methodes: detail === undefined ? [] : lireMethodes(String(detail.methodes)),
  };
}

function chemminsDepuisArbre(arbre: string): { methode: string; chemin: string }[] {
  const routes: { methode: string; chemin: string }[] = [];
  const pile: string[] = [];
  for (const ligne of arbre.split('\n')) {
    const noeud = lireNoeud(ligne);
    if (noeud === null) continue;
    pile.length = noeud.niveau;
    pile.push(noeud.segment);
    const complet = pile.join('');
    for (const methode of noeud.methodes) routes.push({ methode, chemin: complet });
  }
  return routes;
}

async function mesurerRoutes(): Promise<Set<string>> {
  // Service FACTICE : les routes de session, de groupe et de configuration ne
  // s'enregistrent qu'en présence d'un service. Aucun gestionnaire ne tourne.
  const service = {} as unknown as Parameters<typeof creerServeur>[0]['service'];
  const serveur = await creerServeur({
    versionProtocole: api.info?.version ?? '0.0.0',
    ...(service === undefined ? {} : { service }),
  });
  try {
    await serveur.ready();
    const arbre = serveur.printRoutes({ commonPrefix: false });
    return new Set(chemminsDepuisArbre(arbre).map(({ methode, chemin }) => `${methode} ${chemin}`));
  } finally {
    await serveur.close();
  }
}

const servies = await mesurerRoutes();

const ouvertes = [...attendues].filter((route) => servies.has(route));
for (const attendue of attendues) {
  if (servies.has(attendue)) continue;
  const memeChemin = [...servies].find((route) => route.endsWith(attendue.split(' ')[1] ?? '@'));
  signaler(
    'R1',
    `${attendue} déclarée au contrat et NON servie.` +
      (memeChemin === undefined
        ? ''
        : ` Le serveur enregistre « ${memeChemin} » : le préfixe « ${PREFIXE} » manque.`),
  );
}
for (const servie of servies) {
  if (attendues.has(servie)) continue;
  const [methode, chemin] = servie.split(' ');
  const sansPrefixe = attendues.has(`${String(methode)} ${PREFIXE}${String(chemin)}`);
  signaler(
    'R1',
    sansPrefixe
      ? `${servie} est servie SANS le préfixe « ${PREFIXE} » exigé par servers[0].url. ` +
          `Le chemin réel est la seule chose qu’un client atteint : une route juste au mauvais ` +
          `endroit est une route absente.`
      : `${servie} est servie par le serveur et n’est déclarée dans AUCUN paths du contrat. ` +
          `Une route non contractuelle est une surface d’attaque que personne ne relit.`,
  );
}
constats.push(
  `R1 — ${String(ouvertes.length)} route(s) sur ${String(attendues.size)} servies sous ` +
    `« ${PREFIXE} » ; ${String(servies.size)} route(s) enregistrées au total.`,
);

// --- R2 : aucune réécriture de préfixe dans le proxy du client ---------------

const MOTIFS_REECRITURE: readonly { readonly motif: RegExp; readonly quoi: string }[] = [
  { motif: /rewrite\s*:/u, quoi: 'une clé « rewrite » dans la configuration du proxy' },
  {
    motif: new RegExp(`replace\\(\\s*/\\^\\\\?${PREFIXE.replace('/', '\\/')}/`, 'u'),
    quoi: `une réécriture replace(/^\\${PREFIXE}/…) du préfixe`,
  },
  { motif: /pathRewrite/u, quoi: 'une clé « pathRewrite » (proxy http-proxy-middleware)' },
];

let client = '';
try {
  client = readFileSync(FICHIER_CLIENT, 'utf8');
} catch (erreur) {
  signaler(
    'R2',
    `configuration du client illisible (${FICHIER_CLIENT}) : ${String(erreur)}. ` +
      `La porte se ferme plutôt que de conclure « aucune réécriture » sur un fichier absent.`,
  );
}

if (client !== '') {
  const sansCommentaires = client
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('\n')
    .map((ligne) => ligne.replace(/^\s*\/\/.*$/u, ''))
    .join('\n');
  for (const { motif, quoi } of MOTIFS_REECRITURE) {
    if (!motif.test(sansCommentaires)) continue;
    signaler(
      'R2',
      `${FICHIER_CLIENT} contient ${quoi}. Le préfixe « ${PREFIXE} » doit être servi par le ` +
        `SERVEUR, pas rattrapé par le proxy de développement : une réécriture rend l’écart ` +
        `invisible en développement et total en production (ANO-11).`,
    );
  }
  constats.push(
    `R2 — configuration du client lue (${String(sansCommentaires.split('\n').length)} lignes), ` +
      `${String(MOTIFS_REECRITURE.length)} motifs de réécriture recherchés.`,
  );
}

// --- Verdict -----------------------------------------------------------------

const verdict = anomalies.length === 0 ? 'CONFORME' : 'DIVERGENCE';
console.log('PORTE — routes : paths de API-GDV-001 ↔ table de routes du serveur (ADR-TL-23)');
console.log(`  contrats : ${DOSSIER_CONTRATS}`);
console.log(`  client   : ${FICHIER_CLIENT}`);
console.log('-'.repeat(78));
for (const constat of constats) console.log(`  ok   ${constat}`);
if (anomalies.length > 0) {
  console.log('');
  for (const { controle, detail } of anomalies) console.log(`  ÉCHEC [${controle}] ${detail}`);
}
console.log('-'.repeat(78));
console.log(
  `VERDICT ${verdict} — ${String(ouvertes.length)}/${String(attendues.size)} routes, ` +
    `${String(anomalies.length)} divergence(s)`,
);

process.exit(anomalies.length === 0 ? 0 : 1);
