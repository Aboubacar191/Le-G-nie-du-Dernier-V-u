// Fourniture du magasin aux composants.
//
// Un seul magasin par application, injecté depuis la racine. Aucun composant ne
// l'importe directement : un import global rendrait tout écran impossible à
// instancier sans état, et donc impossible à relire isolément.

import { inject, provide, type InjectionKey } from 'vue';

import type { Magasin } from './session.ts';

export const CLE_MAGASIN: InjectionKey<Magasin> = Symbol('gdv.magasin');

export const fournirMagasin = (magasin: Magasin): void => provide(CLE_MAGASIN, magasin);

/**
 * Récupère le magasin. L'absence est une erreur de montage, pas un cas de jeu :
 * elle doit échouer bruyamment au développement plutôt que produire un écran
 * vide en partie.
 */
export function utiliserMagasin(): Magasin {
  const magasin = inject(CLE_MAGASIN);
  if (magasin === undefined) {
    throw new Error('magasin absent : fournirMagasin doit être appelé à la racine');
  }
  return magasin;
}
