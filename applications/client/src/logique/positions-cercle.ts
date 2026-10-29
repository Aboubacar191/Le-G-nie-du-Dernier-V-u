// Correspondance entre le cercle AFFICHÉ et le cercle PHYSIQUE — RG-06.
//
// Ce n'est pas une décoration. Le gabarit de révélation VOISINAGE n'a de sens
// que si la carte affichée à gauche est bien celle du marchand assis à gauche.
// Un cercle faux rend une révélation VRAIE incompréhensible, et détruit la
// confiance dans l'arbitre — qui est la seule autorité de la table.
//
// Saisie (ECR-07) : l'hôte part de lui-même et tourne vers sa GAUCHE, ce qui est
// le sens des aiguilles d'une montre vu de dessus de la table. Donc
// ordre[k + 1] est le voisin de GAUCHE de ordre[k], et le cercle est cyclique :
// le dernier est voisin du premier.
//
// Rendu : chaque client fait tourner la même séquence cyclique pour que SA
// propre carte soit en bas, à 6 heures, en conservant le sens horaire. Sur
// l'écran, tourner dans le sens horaire depuis le bas va vers la GAUCHE
// (6 heures → 7 → 8 → 9) : le voisin de gauche apparaît donc à gauche.
// C'est la propriété vérifiable que tout le dispositif doit tenir.

const DEGRES_TOUR = 360;
const ORIGINE_BAS_DEGRES = 90;
const RADIANS_PAR_DEGRE = Math.PI / 180;

export type Relation = 'moi' | 'gauche' | 'droite' | 'en_face';

export interface PlaceAffichee {
  readonly joueur_id: string;
  /** Rang dans le cercle affiché : 0 = soi, en bas. */
  readonly rang: number;
  /** Angle en degrés, origine en bas, sens horaire. */
  readonly angle_degres: number;
  /** Abscisse relative dans [-1, 1]. −1 = bord gauche du cercle. */
  readonly x: number;
  /** Ordonnée relative dans [-1, 1]. +1 = bas du cercle (axe écran). */
  readonly y: number;
  readonly relation: Relation;
}

/** Vrai si `ordre` est une permutation complète et sans doublon de `joueurs`. */
export function ordreEstValide(
  ordre: readonly string[],
  joueurs: readonly string[],
): boolean {
  if (ordre.length !== joueurs.length) return false;
  const vus = new Set(ordre);
  if (vus.size !== ordre.length) return false;
  return joueurs.every((joueurId) => vus.has(joueurId));
}

/** Relation de voisinage physique pour un rang affiché. */
export function relationPour(rang: number, nbJoueurs: number): Relation {
  if (rang === 0) return 'moi';
  if (rang === 1) return 'gauche';
  if (rang === nbJoueurs - 1) return 'droite';
  return 'en_face';
}

/**
 * Fait tourner l'ordre du cercle pour que `moi` soit en bas, puis place chacun.
 *
 * Retourne un tableau vide si `moi` n'est pas dans l'ordre : c'est l'état
 * « chargement » du composant, jamais une position devinée.
 */
export function disposerCercle(
  ordre: readonly string[],
  moi: string,
): readonly PlaceAffichee[] {
  const nb = ordre.length;
  const indexDeMoi = ordre.indexOf(moi);
  if (nb === 0 || indexDeMoi === -1) return Object.freeze([]);

  const pas = DEGRES_TOUR / nb;
  const places: PlaceAffichee[] = [];
  for (let rang = 0; rang < nb; rang += 1) {
    const joueurId = ordre[(indexDeMoi + rang) % nb];
    if (joueurId === undefined) continue;
    const angle = ORIGINE_BAS_DEGRES + rang * pas;
    const radians = angle * RADIANS_PAR_DEGRE;
    places.push(
      Object.freeze({
        joueur_id: joueurId,
        rang,
        angle_degres: angle,
        x: Math.cos(radians),
        y: Math.sin(radians),
        relation: relationPour(rang, nb),
      }),
    );
  }
  return Object.freeze(places);
}

/** Identifiant du voisin de gauche de `moi`, ou null si le cercle est inconnu. */
export function voisinDeGauche(ordre: readonly string[], moi: string): string | null {
  const places = disposerCercle(ordre, moi);
  return places.find((place) => place.relation === 'gauche')?.joueur_id ?? null;
}

/** Identifiant du voisin de droite de `moi`, ou null si le cercle est inconnu. */
export function voisinDeDroite(ordre: readonly string[], moi: string): string | null {
  const places = disposerCercle(ordre, moi);
  return places.find((place) => place.relation === 'droite')?.joueur_id ?? null;
}

/** Inverse le sens de rotation saisi, sans refaire le placement (ECR-07). */
export function inverserSens(ordre: readonly string[]): readonly string[] {
  if (ordre.length <= 2) return Object.freeze([...ordre]);
  const [premier, ...reste] = ordre;
  return Object.freeze([premier as string, ...reste.reverse()]);
}
