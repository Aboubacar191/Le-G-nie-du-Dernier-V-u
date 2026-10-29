// Accès au contenu affichable — RG-61.
//
// Le serveur n'émet AUCUN libellé : il émet des clés techniques, des index de
// variante et des valeurs numériques. Tout le français de l'application vit
// dans contenu/*.json, et il n'en sort que par ce module.
//
// Conséquence voulue : trancher l'univers visuel (ESC-01) se fait en remplaçant
// des valeurs de fichier de contenu, sans toucher à un composant, à un écran ni
// au serveur.

import fr from '../contenu/fr.json' with { type: 'json' };
import revelations from '../contenu/revelations.fr.json' with { type: 'json' };

/** Valeurs de substitution. Entiers et chaînes seulement : aucun objet affiché. */
export type Valeurs = Readonly<Record<string, string | number>>;

/**
 * Marqueur d'une clé absente. Un trou doit être VISIBLE à l'écran plutôt que
 * silencieux : un libellé vide est un défaut qu'on ne retrouve jamais, un
 * marqueur est un défaut qu'on corrige à la première relecture. Le test
 * contenu.test.ts interdit par ailleurs toute clé absente.
 */
export const marqueurAbsence = (chemin: string): string => `⟦${chemin}⟧`;

function descendre(racine: unknown, chemin: string): unknown {
  let courant: unknown = racine;
  for (const segment of chemin.split('.')) {
    if (courant === null || typeof courant !== 'object') return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

/** Remplace les {jetons} par leurs valeurs. Un jeton sans valeur reste visible. */
export function substituer(gabarit: string, valeurs: Valeurs = {}): string {
  return gabarit.replaceAll(/\{([a-z_0-9]+)\}/gu, (complet, nom: string) => {
    const valeur = valeurs[nom];
    return valeur === undefined ? complet : String(valeur);
  });
}

/** Libellé affichable pour un chemin de contenu, substitutions appliquées. */
export function texte(chemin: string, valeurs: Valeurs = {}): string {
  const brut = descendre(fr, chemin);
  if (typeof brut !== 'string') return marqueurAbsence(chemin);
  return substituer(brut, valeurs);
}

/** Vrai si le chemin existe et porte une chaîne non vide. */
export function texteExiste(chemin: string): boolean {
  const brut = descendre(fr, chemin);
  return typeof brut === 'string' && brut.length > 0;
}

/** Catalogue complet, pour les tests et les écrans qui itèrent sur une énumération. */
export const CONTENU = fr;
export const CONTENU_REVELATIONS = revelations;

// --- Composition d'une révélation --------------------------------------------

/**
 * Révélation telle que le protocole la transporte : un gabarit, un index de
 * variante, des cibles (identifiants de joueur) et des valeurs numériques.
 * AUCUN texte (ADR-TL-12).
 */
export interface RevelationALire {
  readonly gabarit: string;
  readonly variante_formulation: number;
  readonly cibles: readonly string[];
  readonly valeurs: Readonly<Record<string, number>>;
}

const NOMS_DE_CIBLE = ['cible', 'a', 'b'] as const;

/** Accord grammatical : « un » quand la valeur de compte vaut 1, « plusieurs » sinon. */
function formeAccord(valeurs: Readonly<Record<string, number>>): 'un' | 'plusieurs' {
  return valeurs.k === 1 ? 'un' : 'plusieurs';
}

function appliquerAccords(phrase: string, valeurs: Readonly<Record<string, number>>): string {
  const forme = formeAccord(valeurs);
  const accords = revelations.accords as Readonly<Record<string, Record<string, string>>>;
  let resultat = phrase;
  for (const [nom, formes] of Object.entries(accords)) {
    const mot = formes[forme];
    if (mot === undefined) continue;
    resultat = resultat.replaceAll(`{${nom}}`, mot);
  }
  return resultat;
}

/**
 * Compose la phrase du génie depuis le gabarit, la variante et les valeurs.
 *
 * `pseudonyme` résout un identifiant de joueur en pseudo : la résolution n'est
 * pas faite ici, car ce module ne connaît pas la table. Un identifiant non
 * résolu reste un identifiant, ce qui est visible et donc corrigeable.
 */
export function composerRevelation(
  revelation: RevelationALire,
  pseudonyme: (joueurId: string) => string,
): string {
  const variantes = descendre(revelations.variantes, revelation.gabarit);
  if (!Array.isArray(variantes) || variantes.length === 0) {
    return marqueurAbsence(`revelations.variantes.${revelation.gabarit}`);
  }
  // Index hors tableau : repli sur 0, prescrit par API-GDV-001 / RevelationPublique.
  const index = Number.isInteger(revelation.variante_formulation)
    ? revelation.variante_formulation
    : 0;
  const gabarit = (variantes[index] ?? variantes[0]) as string;

  const valeurs: Record<string, string | number> = { ...revelation.valeurs };
  revelation.cibles.forEach((joueurId, rang) => {
    const nom = NOMS_DE_CIBLE[rang];
    if (nom !== undefined) valeurs[nom] = pseudonyme(joueurId);
  });

  return substituer(appliquerAccords(gabarit, revelation.valeurs), valeurs);
}

/** Phrase de l'écart total, systématiquement émis en phase REVELATION. */
export function composerEcartTotal(
  totalDeclare: number,
  totalPaye: number,
  variante = 0,
): string {
  return composerRevelation(
    {
      gabarit: 'ECART_TOTAL',
      variante_formulation: variante,
      cibles: [],
      valeurs: { total_declare: totalDeclare, total_paye: totalPaye },
    },
    (identifiant) => identifiant,
  );
}
