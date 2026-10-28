// Les deux vérificateurs de propriété, partagés par les tests de projection.
//
//  (P-a) CLÔTURE — toute clé présente dans la sortie est déclarée dans le
//        schéma de l'événement ; aucune clé surnuméraire, jamais.
//  (P-b) APPARTENANCE — pour toute clé dont le couple (entite, champ) figure
//        dans registre_champs_secrets, la VALEUR émise appartient au
//        destinataire, ou le destinataire relève de la classe x-visibilite
//        déclarée par l'événement pour cette donnée.
//
// Ils vivent ici pour être appliqués à l'identique par les deux campagnes — le
// tirage aléatoire et l'exhaustivité sur les 30 événements. Deux copies d'un
// vérificateur de sécurité, c'est une qui finira par être plus indulgente.

import { NOM_SCHEMA_PAR_EVENEMENT, type TypeEvenement } from '@gdv/partage';
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

/** (P-a) — rend le motif de l'écart, ou null si la charge est close. */
export function verifierCloture(
  type: TypeEvenement,
  charge: Readonly<Record<string, unknown>>,
): string | null {
  const ecarts = ecartsDeCloture(NOM_SCHEMA_PAR_EVENEMENT[type], charge);
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
