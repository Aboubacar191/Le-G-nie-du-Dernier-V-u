// Les TROIS vérificateurs de propriété, partagés par les tests de projection.
//
//  (P-a) CLÔTURE — toute clé présente dans la sortie est déclarée dans le
//        schéma de l'événement ; aucune clé surnuméraire, jamais.
//  (P-b) APPARTENANCE — pour toute clé dont le couple (entite, champ) figure
//        dans registre_champs_secrets, la VALEUR émise appartient au
//        destinataire, ou le destinataire relève de la classe x-visibilite
//        déclarée par l'événement pour cette donnée.
//  (P-c) ÉGALITÉ EXACTE DE L'ENSEMBLE DES CLÉS — ajouté en ARCHI 1.2.0
//        (ADR-TL-20, ADR-TL-22). L'ensemble des clés de la charge est ÉGAL, au
//        sens de l'égalité d'ensembles, à EXACTEMENT l'un de trois ensembles :
//        la variante complète, x-charge-neutre, ou une variante nommée de
//        x-charge-par-destinataire. Un ensemble INTERMÉDIAIRE est un défaut
//        bloquant, et l'égalité est exigée — pas l'inclusion.
//
// Ils vivent ici pour être appliqués à l'identique par les deux campagnes — le
// tirage aléatoire et l'exhaustivité sur les 30 événements. Deux copies d'un
// vérificateur de sécurité, c'est une qui finira par être plus indulgente.

import {
  CHAMPS_DECLARES_PAR_EVENEMENT,
  CHARGE_NEUTRE_PAR_EVENEMENT,
  NOM_SCHEMA_PAR_EVENEMENT,
  VARIANTES_CHARGE_PAR_EVENEMENT,
  type TypeEvenement,
} from '@gdv/partage';
import type { EtatSession } from '@gdv/moteur';

import { ecartsDeCloture } from './cloture-contrat.ts';
import { CHAMPS_JAMAIS_EMIS, REGLES_APPARTENANCE } from './appartenance.ts';

/** Tous les couples (clé, valeur) d'une charge, à toute profondeur. */
export function cheminsEtValeurs(
  valeur: unknown,
  trouves: { cle: string; valeur: unknown }[] = [],
): { cle: string; valeur: unknown }[] {
  if (Array.isArray(valeur)) {
    for (const element of valeur) cheminsEtValeurs(element, trouves);
  } else if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, sous] of Object.entries(valeur)) {
      trouves.push({ cle, valeur: sous });
      cheminsEtValeurs(sous, trouves);
    }
  }
  return trouves;
}

// --- (P-c) ÉGALITÉ EXACTE DE L'ENSEMBLE DES CLÉS -----------------------------

const memeEnsemble = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** Les trois familles d'ensembles ADMIS pour un type d'événement. */
export function variantesAdmises(type: TypeEvenement): readonly (readonly string[])[] {
  const admises: (readonly string[])[] = [CHAMPS_DECLARES_PAR_EVENEMENT[type]];
  const neutre = CHARGE_NEUTRE_PAR_EVENEMENT[type];
  if (neutre !== null) admises.push(neutre);
  const variantes = VARIANTES_CHARGE_PAR_EVENEMENT[type];
  if (variantes !== null) admises.push(...Object.values(variantes));
  return admises;
}

/**
 * (P-c) — rend le motif de l'écart, ou null si l'ensemble des clés est égal à
 * une variante déclarée.
 *
 * Trois choses que (P-a) et (P-b) ne voient pas :
 *   1. La raison de son existence : pour un schéma annoté x-emission, `required`
 *      ne gouverne QUE la variante complète, donc aucun validateur générique ne
 *      peut contrôler la variante neutre — il n'y a personne d'autre pour le
 *      faire.
 *   2. La régression qui réintroduirait pret, montant_preleve ou reliquat_du
 *      dans la charge du PRÊTEUR de EvtPretPreleve, c'est-à-dire la réouverture
 *      de ANO-07, que (P-b) ne détecterait pas puisque le prêteur est partie au
 *      prêt.
 *   3. La charge « à moitié remplie » : un développeur qui construit la charge
 *      neutre en SUPPRIMANT les champs un par un, au lieu de partir de l'ensemble
 *      vide, laissera un champ au premier ajout de propriété.
 */
export function verifierClesEmises(
  type: TypeEvenement,
  charge: Readonly<Record<string, unknown>>,
): string | null {
  const cles = Object.keys(charge);
  if (variantesAdmises(type).some((variante) => memeEnsemble(cles, variante))) return null;
  return (
    `(P-c) ${NOM_SCHEMA_PAR_EVENEMENT[type]} émet l'ensemble de clés ` +
    `{${cles.join(', ')}}, qui n'est égal à AUCUNE variante déclarée : ni la variante ` +
    `complète {${CHAMPS_DECLARES_PAR_EVENEMENT[type].join(', ')}}, ni x-charge-neutre ` +
    `{${(CHARGE_NEUTRE_PAR_EVENEMENT[type] ?? ['—aucune—']).join(', ')}}, ni une variante de ` +
    `x-charge-par-destinataire (${Object.keys(VARIANTES_CHARGE_PAR_EVENEMENT[type] ?? {}).join(', ') || 'aucune'}). ` +
    `Un ensemble INTERMÉDIAIRE est un défaut bloquant : c'est la charge « à moitié vidée ».`
  );
}

/**
 * La charge est-elle une variante NEUTRE ou RÉDUITE, par opposition à la
 * variante complète ? La question se pose pour (P-a) : `required` ne gouverne
 * que la variante complète (API / portee_de_required), et exiger les clés
 * requises d'une charge neutre reviendrait à exiger qu'elle ne soit pas neutre.
 */
function estVarianteReduite(
  type: TypeEvenement,
  charge: Readonly<Record<string, unknown>>,
): boolean {
  if (memeEnsemble(Object.keys(charge), CHAMPS_DECLARES_PAR_EVENEMENT[type])) return false;
  return verifierClesEmises(type, charge) === null;
}

/**
 * (P-a) — rend le motif de l'écart, ou null si la charge est close.
 *
 * La clôture — « aucune clé surnuméraire, jamais » — s'applique à TOUTES les
 * variantes sans exception. Seule l'exigence de PRÉSENCE des clés requises est
 * restreinte à la variante complète, et c'est le contrat qui le dit : « pour un
 * schéma annoté x-emission, la liste required gouverne la SEULE variante
 * complète ». Le relâchement n'est pas discrétionnaire : il est subordonné au
 * verdict de (P-c), donc à l'égalité EXACTE avec une variante déclarée. Une
 * charge à qui il manque une clé sans être égale à une variante échoue aux deux.
 */
export function verifierCloture(
  type: TypeEvenement,
  charge: Readonly<Record<string, unknown>>,
): string | null {
  const reduite = estVarianteReduite(type, charge);
  const ecarts = ecartsDeCloture(NOM_SCHEMA_PAR_EVENEMENT[type], charge).filter(
    (ecart) => !(reduite && ecart.motif === 'clé REQUISE absente de la charge'),
  );
  if (ecarts.length === 0) return null;
  return `(P-a) ${type} : ${ecarts.map((ecart) => `${ecart.chemin} — ${ecart.motif}`).join(' ; ')}`;
}

function motifDeFuite(
  type: TypeEvenement,
  destinataire: string,
  cle: string,
  valeur: unknown,
  regle: (typeof REGLES_APPARTENANCE)[string],
): string {
  return (
    `(P-b) ${type} → ${destinataire} : le champ ${cle} porte ${JSON.stringify(valeur)}, ` +
    `qui n'appartient pas au destinataire et n'est pas libéré par cet événement ` +
    `[(${regle.entite}, ${regle.champ}) — ${regle.motif}]`
  );
}

/** (P-b) — rend le motif de la fuite, ou null si la charge est légitime. */
export function verifierAppartenance(
  etat: EtatSession,
  type: TypeEvenement,
  destinataire: string,
  charge: Readonly<Record<string, unknown>>,
): string | null {
  for (const { cle, valeur } of cheminsEtValeurs(charge)) {
    if (CHAMPS_JAMAIS_EMIS.includes(cle)) {
      return `(P-b) ${type} porte le champ ${cle}, qui ne doit JAMAIS être émis`;
    }
    const regle = REGLES_APPARTENANCE[cle];
    if (regle === undefined) continue;
    if (valeur === null || valeur === undefined) continue;
    if (regle.publie_par.includes(type)) continue;
    if (regle.valeursAutorisees(etat, destinataire).has(valeur)) continue;
    return motifDeFuite(type, destinataire, cle, valeur, regle);
  }
  return null;
}
