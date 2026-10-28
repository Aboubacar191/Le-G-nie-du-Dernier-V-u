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

/**
 * Ordre NORMATIF de consommation de l'aléa
 * (ARCHI conventions.determinisme_et_alea.ordre_de_consommation).
 *
 * « Changer cet ordre invalide le rejeu de tout journal existant : c'est une
 *   rupture de compatibilité à déclarer. » Une règle que l'on peut lire est une
 * règle que l'on peut tester : la voici en données, et un test la confronte au
 * contrat d'architecture.
 */
export const ORDRE_CONSOMMATION_ALEA: readonly string[] = Object.freeze([
  'roles',
  'missions',
  'mode_avance',
  'clause',
  'porteur',
  'variante_formulation',
]);

export interface Alea {
  /** Entier dans [min, max] inclus. */
  entier(min: number, max: number): number;
  /** Un élément de la liste. */
  choisir<T>(liste: readonly T[]): T;
  /** Permutation de la liste, sans modifier l'original. */
  melanger<T>(liste: readonly T[]): readonly T[];
  booleen(): boolean;
}
