// Table de correspondance type d'événement → applicateur.
//
// Les 30 types d'événement du contrat sont couverts, et la couverture est
// VÉRIFIÉE : evenements-couverts.test.ts confronte cette table à TYPES_EVENEMENT
// de @gdv/partage. Un type ajouté au protocole sans applicateur fait échouer le
// test plutôt que de disparaître silencieusement à l'exécution.

import { TYPES_EVENEMENT, type EnveloppeEvenement, type TypeEvenement } from '@gdv/partage';

import { integrer } from '../logique/decalage-horloge.ts';
import type { EtatLocal } from './etat.ts';
import { APPLICATEURS_MANCHE } from './reducteurs-manche.ts';
import { APPLICATEURS_PRIVE } from './reducteurs-prive.ts';
import { APPLICATEURS_SESSION, type Applicateur } from './reducteurs-session.ts';

export const APPLICATEURS: Readonly<Record<string, Applicateur>> = Object.freeze({
  ...APPLICATEURS_SESSION,
  ...APPLICATEURS_MANCHE,
  ...APPLICATEURS_PRIVE,
});

/** Types du contrat sans applicateur. Vide par construction, vérifié par test. */
export const TYPES_NON_COUVERTS: readonly TypeEvenement[] = Object.freeze(
  TYPES_EVENEMENT.filter((type) => APPLICATEURS[type] === undefined),
);

/**
 * Applique une enveloppe reçue.
 *
 * Le décalage d'horloge est intégré pour CHAQUE enveloppe, quel que soit son
 * type (RG-79) : c'est la seule source de synchronisation, et l'écarter pour
 * certains types reviendrait à réduire la taille de l'échantillon sans raison.
 */
export function appliquerEvenement(
  etat: EtatLocal,
  enveloppe: EnveloppeEvenement,
  recuAMs: number,
): void {
  etat.decalage = integrer(etat.decalage, enveloppe.emis_a, recuAMs);
  etat.derniere_sequence = enveloppe.sequence;

  const applicateur = APPLICATEURS[enveloppe.type];
  // Un type inconnu n'est pas appliqué, et il n'est pas non plus ignoré en
  // silence : il est signalé en alerte d'information. Un client plus ancien que
  // le serveur doit le dire, pas faire semblant de comprendre.
  if (applicateur === undefined) {
    etat.alerte = { variante: 'information', cle_contenu: 'commun.chargement', valeurs: {} };
    return;
  }
  applicateur(etat, enveloppe.charge);
}
