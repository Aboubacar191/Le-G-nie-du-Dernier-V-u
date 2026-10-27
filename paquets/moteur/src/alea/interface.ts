// Source d'aléa INJECTÉE (ADR-TL-08).
//
// Le moteur ne tire JAMAIS un nombre lui-même : Math.random et crypto sont
// bannis du paquet par règle ESLint. Sans cette interface, aucun test n'est
// reproductible et le rejeu du journal ne reconstruit pas le même état.
//
// L'ordre de consommation des tirages est NORMATIF (ARCHI
// conventions.determinisme_et_alea) : rôles, puis missions, puis — en mode
// avancé — MARCHAND_DEJA_LIE et GARDIEN_DE_LA_LAMPE, puis par manche : clause,
// porteur, variante de formulation. Changer cet ordre invalide le rejeu de tout
// journal existant : c'est une rupture de compatibilité à déclarer.

export interface Alea {
  /** Entier dans [min, max] inclus. */
  entier(min: number, max: number): number;
  /** Un élément de la liste. */
  choisir<T>(liste: readonly T[]): T;
  /** Permutation de la liste, sans modifier l'original. */
  melanger<T>(liste: readonly T[]): readonly T[];
  booleen(): boolean;
}
