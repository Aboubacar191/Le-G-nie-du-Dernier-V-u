// Machine à états du voile de secret — mesures M1, M2, M3 et M5.
//
// M1 Masquage par défaut   : l'état d'arrivée est TOUJOURS « masque ». Aucune
//                            révélation automatique, au chargement ni par minuteur.
// M2 Révélation volontaire : un geste maintenu, ou un contact simple qui ouvre
//                            une révélation minutée pour qui ne peut pas maintenir.
// M3 Remasquage automatique: relâchement, expiration, perte de focus, défilement,
//                            changement de phase. Aucune condition ne laisse un
//                            secret affiché.
// M5 Aucune persistance    : après validation d'un acte secret, l'état est
//                            « scelle » et aucune valeur n'y revient, jamais.
//
// Les neuf états sont ceux du contrat de conception, ni plus ni moins : un état
// absent de cette liste est un état interdit, pas un état libre.

export const ETATS_VOILE = [
  'masque',
  'actif',
  'revele_maintenu',
  'revele_minute',
  'focus',
  'desactive',
  'chargement',
  'erreur',
  'scelle',
] as const;

export type EtatVoile = (typeof ETATS_VOILE)[number];

/** Les deux états où une valeur secrète est présente dans l'arbre de rendu. */
export const ETATS_REVELES: readonly EtatVoile[] = Object.freeze([
  'revele_maintenu',
  'revele_minute',
]);

export const estRevele = (etat: EtatVoile): boolean => ETATS_REVELES.includes(etat);

/**
 * Événements admis. `remasquer` couvre indifféremment le relâchement, la perte
 * de focus, le changement de visibilité, le défilement et le changement de
 * phase : ce sont cinq causes pour un seul effet, et les traiter séparément
 * n'ouvrirait que des occasions d'en oublier une (M3).
 */
export type EvenementVoile =
  | 'arriver'
  | 'presser'
  | 'maintenir'
  | 'contact_simple'
  | 'remasquer'
  | 'focaliser'
  | 'defocaliser'
  | 'charger'
  | 'echouer'
  | 'desactiver'
  | 'sceller';

/** Les deux états terminaux : plus aucune révélation n'y est possible. */
const TERMINAUX: readonly EtatVoile[] = Object.freeze(['scelle', 'desactive']);

/** Seuls événements qui rouvrent un état terminal : nouvelle arrivée, nouveau chargement. */
const SORTIES_DE_TERMINAL: readonly EvenementVoile[] = Object.freeze(['arriver', 'charger']);

/** Transitions inconditionnelles : l'état d'origine n'entre pas en compte. */
const TRANSITIONS_DIRECTES: Readonly<Partial<Record<EvenementVoile, EtatVoile>>> = Object.freeze({
  arriver: 'masque',
  charger: 'chargement',
  echouer: 'erreur',
  desactiver: 'desactive',
  sceller: 'scelle',
  // M3 : cinq causes de remasquage (relâchement, blur, visibilitychange,
  // défilement, changement de phase) pour un seul effet.
  remasquer: 'masque',
  defocaliser: 'masque',
});

interface TransitionGardee {
  readonly depuis: readonly EtatVoile[];
  readonly vers: EtatVoile;
}

/** Transitions qui n'ont lieu que depuis certains états. */
const TRANSITIONS_GARDEES: Readonly<Partial<Record<EvenementVoile, TransitionGardee>>> =
  Object.freeze({
    focaliser: { depuis: ['masque'], vers: 'focus' },
    presser: { depuis: ['masque', 'focus'], vers: 'actif' },
    maintenir: { depuis: ['actif'], vers: 'revele_maintenu' },
    contact_simple: { depuis: ['masque', 'focus', 'actif'], vers: 'revele_minute' },
  });

/**
 * Transition. Toute transition non déclarée laisse l'état inchangé : une
 * machine qui tolère l'inconnu en restant masquée est préférable à une machine
 * qui s'ouvre par défaut.
 */
export function transiter(etat: EtatVoile, evenement: EvenementVoile): EtatVoile {
  // M5 : un acte scellé ne se rouvre pas, et un voile désactivé ne révèle rien.
  if (TERMINAUX.includes(etat) && !SORTIES_DE_TERMINAL.includes(evenement)) return etat;

  const direct = TRANSITIONS_DIRECTES[evenement];
  if (direct !== undefined) return direct;

  const gardee = TRANSITIONS_GARDEES[evenement];
  if (gardee !== undefined && gardee.depuis.includes(etat)) return gardee.vers;

  return etat;
}

const LIBELLES: Readonly<Partial<Record<EtatVoile, string>>> = Object.freeze({
  chargement: 'voile.chargement',
  erreur: 'voile.erreur',
  desactive: 'voile.rien_a_reveler',
  scelle: 'voile.scelle',
});

/** Clé de contenu du libellé persistant de l'état. Jamais une chaîne en dur. */
export const cleLibelle = (etat: EtatVoile): string =>
  LIBELLES[etat] ?? 'voile.libelle_masque';

/** Vrai si la zone de maintien accepte un geste dans cet état. */
export function zoneActionnable(etat: EtatVoile): boolean {
  return etat !== 'chargement' && etat !== 'desactive' && etat !== 'scelle';
}
