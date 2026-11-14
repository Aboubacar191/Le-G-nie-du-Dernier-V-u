// =============================================================================
// PROFILS DE FORME — mesure et comparaison, pour la porte verifier:uniformite
// =============================================================================
// Un PROFIL DE FORME est, pour un joueur donné, la suite ordonnée des trames
// qu'il reçoit, réduite à ce qu'un observateur du réseau peut lire SANS
// déchiffrer : le TYPE, la TAILLE et le RANG. Jamais le contenu.
//
// Le rang tient lieu de numéro de séquence. RUP-01 fait passer la séquence de
// « par destinataire » à « par session » : si les N suites de types sont égales
// terme à terme, alors la k-ième trame de chaque joueur appartient au même lot
// et un compteur de session leur attribue le MÊME numéro. L'égalité des suites
// de types est donc exactement le contrôle de séquence, et c'est le moins
// coûteux de la porte — il ne demande aucune instrumentation du transport.
//
// Ce module ne lit JAMAIS une charge, à DEUX exceptions près et elles sont
// déclarées : le test P-c compare l'ENSEMBLE DES CLÉS émises aux variantes du
// contrat (il regarde les noms des clés, jamais les valeurs), et U1c (ci-
// dessous) réexpose la charge au SEUL remplissage de remplissage.ts — une
// transformation qui ne connaît, elle non plus, aucun champ : elle compte des
// octets. Aucune des deux lectures ne compare de VALEUR de champ.
// =============================================================================

import { cibleCommune, completer, octets as octetsDe } from '../../applications/serveur/src/temps-reel/remplissage.ts';
import type { Trame } from '../../qa/sondes/banc.ts';
import type { SchemaEvt, Signaler } from './contrat.ts';

export interface Profil {
  readonly joueur: string;
  readonly types: readonly string[];
  readonly octets: readonly number[];
  readonly ordres: readonly number[];
  readonly charges: readonly Readonly<Record<string, unknown>>[];
}

export function profils(trames: readonly Trame[], joueurs: readonly string[]): readonly Profil[] {
  return joueurs.map((joueur) => {
    const siennes = trames.filter((trame) => trame.pour === joueur);
    return {
      joueur,
      types: siennes.map((trame) => trame.type),
      octets: siennes.map((trame) => trame.octets),
      ordres: siennes.map((trame) => trame.ordre),
      charges: siennes.map((trame) => trame.charge),
    };
  });
}

const premier = <T>(liste: readonly T[]): T | undefined => liste[0];

/** U1a — le NOMBRE de trames est le même pour tous les joueurs. */
export function controlerNombre(
  mesures: readonly Profil[],
  etiquette: string,
  signaler: Signaler,
): boolean {
  const reference = premier(mesures);
  if (reference === undefined) return false;
  const divergents = mesures.filter((profil) => profil.types.length !== reference.types.length);
  if (divergents.length === 0) return true;
  const compte = mesures.map((profil) => `${profil.joueur}:${String(profil.types.length)}`);
  signaler(
    'U1a',
    `${etiquette} — le nombre de trames diffère selon le destinataire : {${compte.join(', ')}}. ` +
      `Un observateur qui COMPTE les trames, sans en lire aucune, distingue les joueurs. ` +
      `C'est le canal de ANO-01 et ANO-02, mesurées.`,
  );
  return false;
}

/**
 * U1b — la suite des TYPES, donc des numéros de séquence par session, est la
 * même pour tous. Un seul écart est signalé par joueur : le premier, qui est
 * celui qui explique les suivants.
 */
export function controlerSequence(
  mesures: readonly Profil[],
  etiquette: string,
  signaler: Signaler,
): boolean {
  const reference = premier(mesures);
  if (reference === undefined) return false;
  let conforme = true;
  for (const profil of mesures.slice(1)) {
    const rang = profil.types.findIndex((type, index) => type !== reference.types[index]);
    if (rang === -1 && profil.types.length === reference.types.length) continue;
    conforme = false;
    const position = rang === -1 ? Math.min(profil.types.length, reference.types.length) : rang;
    signaler(
      'U1b',
      `${etiquette} — au rang ${String(position)}, ${reference.joueur} reçoit ` +
        `« ${String(reference.types[position] ?? 'rien')} » et ${profil.joueur} reçoit ` +
        `« ${String(profil.types[position] ?? 'rien')} ». Les numéros de séquence par session ` +
        `(RUP-01) ne peuvent donc pas être égaux entre destinataires.`,
    );
  }
  return conforme;
}

/**
 * U1d — ALIGNEMENT DES LOTS. L'égalité des suites de types (U1b) raisonne par
 * RANG : elle ne distingue pas « J0 a reçu sa trame au lot 5 » de « J1 a reçu la
 * sienne au lot 9 ». Un événement émis à chacun des N joueurs MAIS à N instants
 * différents — paiement_enregistre envoyé au seul payeur, quand les N joueurs
 * paient tous dans le même ordre — franchit donc U1a, U1b et U4 sans être
 * uniforme pour autant : un observateur voit une trame partir vers UN téléphone
 * à l'instant où ce joueur agit.
 *
 * Le contrôle exact ne demande aucune heuristique de découpage : sous l'émission
 * de lot exigée par RUP-02, les N trames d'un même lot sont CONSÉCUTIVES dans
 * l'ordre global d'émission. Les N trames de même rang doivent donc porter N
 * numéros d'ordre consécutifs, c'est-à-dire un écart de N−1 exactement.
 */
export function controlerAlignement(
  mesures: readonly Profil[],
  etiquette: string,
  signaler: Signaler,
): boolean {
  const reference = premier(mesures);
  if (reference === undefined) return false;
  const attendu = mesures.length - 1;
  let rangs = 0;
  let exemple: string | null = null;
  for (let rang = 0; rang < reference.ordres.length; rang += 1) {
    const ordres = mesures.map((profil) => profil.ordres[rang]).filter((o) => o !== undefined);
    if (ordres.length !== mesures.length) continue;
    const ecart = Math.max(...ordres) - Math.min(...ordres);
    if (ecart === attendu) continue;
    rangs += 1;
    exemple ??=
      `rang ${String(rang)}, type « ${String(reference.types[rang])} » : écart d'ordre ` +
      `${String(ecart)} au lieu de ${String(attendu)}`;
  }
  if (rangs === 0) return true;
  signaler(
    'U1d',
    `${etiquette} — ${String(rangs)} rang(s) dont les N trames ne sont PAS consécutives dans ` +
      `l'ordre d'émission : elles ne partent donc pas dans le même lot (${String(exemple)}). ` +
      `Une trame qui part vers UN téléphone à l'instant où son destinataire agit est lisible ` +
      `même si le dénombrement final est égal.`,
  );
  return false;
}

export interface EcartTaille {
  readonly rangs: number;
  readonly ecartMax: number;
  readonly exemple: string | null;
}

/**
 * U1c — écart de taille APRÈS remplissage, rang par rang.
 *
 * La mesure BRUTE (avant remplissage) diffère presque toujours d'un joueur à
 * l'autre — un pseudo plus long, un montant à trois chiffres — et c'est
 * précisément ce que RUP-03 existe pour absorber. La comparer sans appliquer
 * le remplissage reviendrait à juger un correctif sur l'état d'AVANT le
 * correctif : ce module applique donc la MÊME fonction que diffuseur.ts,
 * cibleCommune puis completer, sur chaque lot (les N charges d'un même rang),
 * et compare les tailles qui en résultent — celles qui partent réellement sur
 * le socket. Par construction, cibleCommune choisit le maximum du lot comme
 * cible : toutes les trames du lot sont donc complétées à la MÊME taille,
 * sauf dans le seul cas où completer y renonce — une trame qui, même nue,
 * dépasse déjà le plafond TAILLE_MAX_TRAME_SORTANTE_OCTETS (le résidu
 * EvtEtatCompletPrive, inscrit en dette assumée par ARCHI-GDV-001.json /
 * ADR-TL-20, consequence (5)). C'est l'unique façon dont ce contrôle peut
 * encore trouver un écart.
 *
 * Simulé sur une ENVELOPPE, jamais sur la charge nue : diffuseur.ts appelle
 * cibleCommune et completer sur l'enveloppe entière (type, sequence, emis_a,
 * id_correlation, charge), qui porte toujours au moins une clé. Simuler sur
 * la seule charge ferait, pour toute charge neutre VIDE ({}), disparaître la
 * virgule séparatrice que JSON.stringify insère devant « remplissage » dès
 * qu'une clé existe déjà — un octet de différence introduit par la mesure,
 * pas par le transport.
 */
const ENVELOPPE_FACTICE = { type: 't', sequence: 0, emis_a: '2026-01-01T00:00:00.000Z', id_correlation: null };

export function mesurerEcartsDeTaille(mesures: readonly Profil[]): EcartTaille {
  const reference = premier(mesures);
  if (reference === undefined) return { rangs: 0, ecartMax: 0, exemple: null };
  let rangs = 0;
  let ecartMax = 0;
  let exemple: string | null = null;
  for (let rang = 0; rang < reference.charges.length; rang += 1) {
    const chargesDuLot = mesures.map((profil) => profil.charges[rang]).filter((c) => c !== undefined);
    if (chargesDuLot.length === 0) continue;
    const enveloppesDuLot = chargesDuLot.map((charge) => ({ ...ENVELOPPE_FACTICE, charge }));
    const cible = cibleCommune(enveloppesDuLot.map((enveloppe) => JSON.stringify(enveloppe)));
    const tailles = enveloppesDuLot.map((enveloppe) => octetsDe(completer(enveloppe, cible)));
    const mini = Math.min(...tailles);
    const maxi = Math.max(...tailles);
    if (maxi === mini) continue;
    rangs += 1;
    if (maxi - mini <= ecartMax) continue;
    ecartMax = maxi - mini;
    exemple =
      `rang ${String(rang)}, type « ${String(reference.types[rang])} » : ` +
      `${String(mini)} à ${String(maxi)} octets après remplissage (cible ${String(cible)})`;
  }
  return { rangs, ecartMax, exemple };
}

/**
 * U2 — invariance différentielle : deux parties à graine identique ne différant
 * que par un acte secret doivent produire le MÊME profil de forme pour CHAQUE
 * joueur, l'acteur compris. Sa charge peut différer, sa forme non.
 */
export function controlerDifferentiel(
  avant: readonly Profil[],
  apres: readonly Profil[],
  etiquette: string,
  signaler: Signaler,
): boolean {
  let conforme = true;
  for (const profil of avant) {
    const jumeau = apres.find((candidat) => candidat.joueur === profil.joueur);
    if (jumeau === undefined) {
      signaler('U2', `${etiquette} — ${profil.joueur} absent de la variante B.`);
      conforme = false;
      continue;
    }
    const rang = profil.types.findIndex((type, index) => type !== jumeau.types[index]);
    if (rang === -1 && profil.types.length === jumeau.types.length) continue;
    conforme = false;
    const position = rang === -1 ? Math.min(profil.types.length, jumeau.types.length) : rang;
    signaler(
      'U2',
      `${etiquette} — le flux de ${profil.joueur} DÉPEND de l’acte secret : ` +
        `${String(profil.types.length)} trames contre ${String(jumeau.types.length)}, premier ` +
        `écart au rang ${String(position)} (« ${String(profil.types[position] ?? 'rien')} » ` +
        `contre « ${String(jumeau.types[position] ?? 'rien')} »).`,
    );
  }
  return conforme;
}

/**
 * Types d'événement dont le NOMBRE diffère d'un destinataire à l'autre : ce
 * sont les exceptions que le CODE s'accorde, par opposition à celles que le
 * contrat déclare. U4 compare les deux ensembles.
 */
export function exceptionsDeFait(
  trames: readonly Trame[],
  joueurs: readonly string[],
): ReadonlySet<string> {
  const deFait = new Set<string>();
  for (const type of new Set(trames.map((trame) => trame.type))) {
    const comptes = joueurs.map(
      (joueur) => trames.filter((trame) => trame.pour === joueur && trame.type === type).length,
    );
    if (new Set(comptes).size > 1) deFait.add(type);
  }
  return deFait;
}

// --- P-c : égalité EXACTE de l'ensemble des clés émises ----------------------

const memeEnsemble = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

function variantesAdmises(schema: SchemaEvt): readonly (readonly string[])[] {
  const admises: (readonly string[])[] = [schema.proprietes];
  if (schema.chargeNeutre !== null) admises.push(schema.chargeNeutre);
  for (const variante of Object.values(schema.variantes ?? {})) admises.push(variante);
  return admises;
}

export function controlerClesEmises(
  trames: readonly Trame[],
  parType: ReadonlyMap<string, SchemaEvt>,
  signaler: Signaler,
): number {
  const dejaSignale = new Set<string>();
  let controlees = 0;
  for (const trame of trames) {
    const schema = parType.get(trame.type);
    if (schema === undefined) {
      if (dejaSignale.has(trame.type)) continue;
      dejaSignale.add(trame.type);
      signaler('P-c', `type « ${trame.type} » émis sans schéma EvtXxx correspondant au contrat.`);
      continue;
    }
    controlees += 1;
    const cles = Object.keys(trame.charge);
    if (variantesAdmises(schema).some((variante) => memeEnsemble(cles, variante))) continue;
    const signature = `${trame.type}|${[...cles].sort().join(',')}`;
    if (dejaSignale.has(signature)) continue;
    dejaSignale.add(signature);
    signaler(
      'P-c',
      `${schema.nom} émet l’ensemble de clés {${cles.join(', ')}}, qui n’est égal à AUCUNE ` +
        `variante déclarée : ni la variante complète {${schema.proprietes.join(', ')}}, ni ` +
        `x-charge-neutre {${(schema.chargeNeutre ?? []).join(', ')}}, ni une variante de ` +
        `x-charge-par-destinataire (${Object.keys(schema.variantes ?? {}).join(', ') || 'aucune'}). ` +
        `Un ensemble INTERMÉDIAIRE est un défaut bloquant : c'est la charge « à moitié vidée ».`,
    );
  }
  return controlees;
}
