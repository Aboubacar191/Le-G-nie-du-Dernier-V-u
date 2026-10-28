// Générateur sfc32 graine-able, déterministe, sans aucune dépendance.
//
// Le moteur reçoit la GRAINE (sessions.graine_alea, 32 octets tirés par la
// couche transport), jamais le générateur système : Math.random et crypto sont
// bannis du paquet par règle ESLint (ADR-TL-08). C'est la condition du rejeu du
// journal — même graine, même séquence de commandes, même état bit à bit.
//
// L'ordre de consommation des tirages est NORMATIF
// (ARCHI conventions.determinisme_et_alea) : rôles, puis missions, puis — en
// mode avancé — MARCHAND_DEJA_LIE et GARDIEN_DE_LA_LAMPE, puis par manche :
// clause, porteur, variante de formulation. Le changer invalide le rejeu de
// tout journal existant : c'est une rupture de compatibilité à déclarer.
//
// Toutes les constantes de l'algorithme sont nommées : no-magic-numbers est
// actif sur ce paquet et n'y admet que 0 et 1.

import type { Alea } from './interface.ts';

const MOT_GRAINE_INITIAL = 1779033703;
const MELANGE_1 = 3432918353;
const MELANGE_2 = 2246822507;
const MELANGE_3 = 3266489909;
const DECALAGE_GAUCHE_13 = 13;
const DECALAGE_DROITE_19 = 19;
const DECALAGE_DROITE_16 = 16;
const SFC_DECALAGE_A = 9;
const SFC_DECALAGE_B = 3;
const SFC_ROTATION_C = 21;
const SFC_ROTATION_C_INVERSE = 11;
const DIVISEUR_32_BITS = 4294967296;
const NOMBRE_MOTS_GRAINE = 4;

/** xmur3 : dérive une suite de mots de 32 bits depuis une graine textuelle. */
function semeur(graine: string): () => number {
  let h = MOT_GRAINE_INITIAL ^ graine.length;
  for (let i = 0; i < graine.length; i += 1) {
    h = Math.imul(h ^ graine.charCodeAt(i), MELANGE_1);
    h = (h << DECALAGE_GAUCHE_13) | (h >>> DECALAGE_DROITE_19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> DECALAGE_DROITE_16), MELANGE_2);
    h = Math.imul(h ^ (h >>> DECALAGE_GAUCHE_13), MELANGE_3);
    h ^= h >>> DECALAGE_DROITE_16;
    return h >>> 0;
  };
}

function flottants(graine: string): () => number {
  const semence = semeur(graine);
  const mots: number[] = [];
  for (let i = 0; i < NOMBRE_MOTS_GRAINE; i += 1) mots.push(semence());
  let [a, b, c, d] = mots as [number, number, number, number];
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> SFC_DECALAGE_A);
    b = (c + (c << SFC_DECALAGE_B)) | 0;
    c = (c << SFC_ROTATION_C) | (c >>> SFC_ROTATION_C_INVERSE);
    c = (c + t) | 0;
    return (t >>> 0) / DIVISEUR_32_BITS;
  };
}

/** Fabrique un Alea déterministe à partir d'une graine. */
export function creerAleaSfc32(graine: string): Alea {
  if (graine.length === 0) {
    throw new Error('Graine vide : le déterminisme exige une graine explicite.');
  }
  const suivant = flottants(graine);

  const entier = (min: number, max: number): number => {
    if (max < min) {
      throw new Error(`Intervalle vide : entier(${min}, ${max})`);
    }
    if (max === min) return min;
    return min + Math.floor(suivant() * (max - min + 1));
  };

  return {
    entier,
    choisir<T>(liste: readonly T[]): T {
      if (liste.length === 0) {
        throw new Error('choisir() sur une liste vide : l’éligibilité doit être testée avant.');
      }
      const element = liste[entier(0, liste.length - 1)];
      if (element === undefined) {
        throw new Error('Tirage hors bornes : défaut du générateur.');
      }
      return element;
    },
    melanger<T>(liste: readonly T[]): readonly T[] {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = entier(0, i);
        const ici = copie[i] as T;
        const la = copie[j] as T;
        copie[i] = la;
        copie[j] = ici;
      }
      return copie;
    },
    booleen(): boolean {
      return entier(0, 1) === 1;
    },
  };
}

export type CreerAleaSfc32 = typeof creerAleaSfc32;
