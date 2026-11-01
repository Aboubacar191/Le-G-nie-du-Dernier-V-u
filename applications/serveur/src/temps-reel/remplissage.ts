// REMPLISSAGE DES TRAMES SORTANTES — RG-80, RUP-03.
//
// « La FORME du trafic est une information au même titre que son contenu. »
//
// POURQUOI. TLS chiffre le contenu et PRÉSERVE LES LONGUEURS. Une charge neutre
// de 2 octets face à une charge pleine de 862 octets laisse donc fuir, sur le
// fil, exactement le bit que l'émission à tous prétend masquer : le voisin qui
// compte les octets sait lequel des huit téléphones vient de recevoir quelque
// chose. Mesure de la porte d'uniformité avant correctif : 55 rangs de taille
// inégale à 6 joueurs, écart maximal 860 octets sur solde_mis_a_jour.
//
// DEUX RÈGLES, et l'ordre compte.
//   1. Les N trames d'un même LOT sont complétées à une cible COMMUNE : le
//      maximum des N longueurs sérialisées, arrondi au prochain multiple du
//      palier. Une cible calculée trame par trame laisserait deux paliers
//      différents dans le même lot, donc la fuite intacte à l'échelle du palier.
//   2. Le remplissage est appliqué EN DERNIER, juste avant l'écriture. Toute
//      transformation postérieure dépendante du contenu — au premier chef la
//      compression — annulerait le correctif : une charge neutre faite de 1000
//      octets de remplissage se comprime beaucoup mieux qu'une charge pleine
//      complétée à la même taille.
//
// CE MODULE NE DÉCIDE RIEN du jeu : il compte des octets. Il ne lit aucune
// charge, il ne connaît aucun type d'événement.

import { PALIER_TAILLE_OCTETS, TAILLE_MAX_TRAME_SORTANTE_OCTETS } from '@gdv/partage';

/**
 * Caractère de remplissage. ASCII sur UN octet en UTF-8, ce qui rend le calcul
 * « k caractères = k octets » exact. Un caractère accentué en coûterait deux et
 * ferait manquer la cible d'autant.
 */
const CARACTERE = '.';

/** Coût en octets de l'insertion de la clé : `,"remplissage":"` + `"` */
const COUT_CLE = ',"remplissage":""'.length;

/** Longueur en OCTETS, et non en caractères : les accents comptent double. */
export function octets(texte: string): number {
  return Buffer.byteLength(texte, 'utf8');
}

/**
 * Prochain multiple du palier, au moins égal à `minimum`.
 * Le palier est lu dans le contrat (x-temps-reel.canal.palier_taille_octets).
 */
export function cibleAuPalier(minimum: number): number {
  return Math.ceil(minimum / PALIER_TAILLE_OCTETS) * PALIER_TAILLE_OCTETS;
}

/**
 * Cible COMMUNE d'un lot : le maximum des longueurs sérialisées du lot, majoré
 * du coût de la clé de remplissage, arrondi au prochain multiple du palier.
 *
 * Le coût de la clé est intégré AVANT l'arrondi : sans cela, une trame dont la
 * longueur nue tombe pile sur un multiple du palier ne pourrait pas recevoir sa
 * clé sans dépasser, et il faudrait un cas particulier — c'est-à-dire une
 * branche de plus dans le seul endroit du serveur qui doit être trivialement
 * juste.
 */
export function cibleCommune(serialisees: readonly string[]): number {
  let maximum = 0;
  for (const texte of serialisees) maximum = Math.max(maximum, octets(texte));
  return cibleAuPalier(maximum + COUT_CLE);
}

/**
 * Trame complétée à `cible` octets EXACTEMENT, remplissage compris.
 *
 * `trame` est l'objet d'enveloppe déjà construit ; il ne porte pas encore de
 * remplissage. Le résultat est la chaîne à écrire sur le socket.
 *
 * Si la trame nue dépasse déjà la cible — cas d'un etat_complet_prive volumineux
 * confronté à une cible de lot plus petite, qui ne peut pas se produire puisque
 * la cible est le MAXIMUM du lot, mais qui doit être traité — elle est écrite
 * telle quelle plutôt que tronquée : perdre une trame vaut moins qu'émettre une
 * trame illisible, et la divergence de taille se verra à la porte.
 */
export function completer(trame: object, cible: number): string {
  const nue = JSON.stringify(trame);
  const manque = cible - octets(nue) - COUT_CLE;
  if (manque < 0) return nue;
  const complete = JSON.stringify({ ...trame, remplissage: CARACTERE.repeat(manque) });
  return octets(complete) > TAILLE_MAX_TRAME_SORTANTE_OCTETS ? nue : complete;
}
