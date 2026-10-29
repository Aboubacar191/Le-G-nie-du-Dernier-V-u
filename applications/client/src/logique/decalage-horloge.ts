// Décalage d'horloge entre l'appareil et le génie — RG-79, x-temps-reel.horloge.
//
// Le serveur est l'UNIQUE horloge (RG-72). Le décompte affiché est dérivé de
// phase_fin_at, qui est une date absolue, et corrigé du décalage mesuré sur le
// champ emis_a que porte CHAQUE enveloppe reçue.
//
// Sans cette correction, un téléphone dont l'horloge avance de deux secondes
// affiche deux secondes de moins que son voisin. Sur la phase de signature de
// 10 s, la table se désynchronise visiblement. Cible : moins de 500 ms d'écart
// entre huit appareils.
//
// Le décompte ne pilote RIEN : il est décoratif. L'autorité reste au serveur,
// qui fait expirer la phase lui-même.

/** Nombre d'échantillons de la moyenne glissante. */
export const TAILLE_FENETRE = 16;

/**
 * Écart au-delà duquel un échantillon est écarté comme aberrant, en
 * millisecondes. Une trame retardée par le réseau fait paraître l'horloge
 * locale en avance ; un seul paquet arrivé 30 s plus tard ne doit pas emporter
 * la moyenne. Le seuil est large : il élimine les valeurs absurdes (horloge non
 * synchronisée de plusieurs heures après un changement de fuseau) sans toucher
 * à la gigue réseau ordinaire.
 */
export const SEUIL_ABERRANT_MS = 60_000;

export interface EtatDecalage {
  /** Échantillons retenus, du plus ancien au plus récent. */
  readonly echantillons: readonly number[];
  /** Décalage courant en millisecondes : horloge_locale − horloge_serveur. */
  readonly decalage_ms: number;
  /** Faux tant qu'aucun échantillon n'a été retenu. */
  readonly mesure: boolean;
}

export const decalageInitial = (): EtatDecalage =>
  Object.freeze({ echantillons: Object.freeze([]), decalage_ms: 0, mesure: false });

function moyenne(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  let somme = 0;
  for (const valeur of valeurs) somme += valeur;
  return Math.round(somme / valeurs.length);
}

/**
 * Intègre une enveloppe reçue.
 *
 * @param etat          état courant de la mesure
 * @param emisA         champ emis_a de l'enveloppe, date ISO 8601 UTC
 * @param recuAMs       instant de réception, horloge LOCALE, en millisecondes
 *
 * Une date illisible est ignorée : le contrat garantit le format, mais une
 * trame malformée ne doit pas fausser le décompte de toute la partie.
 */
export function integrer(etat: EtatDecalage, emisA: string, recuAMs: number): EtatDecalage {
  const emisMs = Date.parse(emisA);
  if (!Number.isFinite(emisMs)) return etat;

  const echantillon = recuAMs - emisMs;
  if (Math.abs(echantillon) > SEUIL_ABERRANT_MS) return etat;

  const echantillons = [...etat.echantillons, echantillon].slice(-TAILLE_FENETRE);
  return Object.freeze({
    echantillons: Object.freeze(echantillons),
    decalage_ms: moyenne(echantillons),
    mesure: true,
  });
}

/**
 * Convertit une date serveur en instant de l'horloge locale.
 *
 * C'est l'unique conversion autorisée : un composant qui comparerait
 * directement Date.now() à phase_fin_at afficherait le décompte non corrigé que
 * RG-79 interdit.
 */
export function versHorlogeLocale(etat: EtatDecalage, dateServeurIso: string): number | null {
  const serveurMs = Date.parse(dateServeurIso);
  if (!Number.isFinite(serveurMs)) return null;
  return serveurMs + etat.decalage_ms;
}

/**
 * Millisecondes restantes avant une échéance serveur, vues de l'horloge locale.
 * Retourne null quand l'échéance est inconnue ou illisible : l'interface doit
 * alors afficher deux tirets, jamais un zéro — un zéro mentirait sur le temps
 * restant (DESIGN / BandeauPhase état chargement).
 */
export function restantMs(
  etat: EtatDecalage,
  echeanceIso: string | null,
  maintenantMs: number,
): number | null {
  if (echeanceIso === null) return null;
  const echeanceLocale = versHorlogeLocale(etat, echeanceIso);
  if (echeanceLocale === null) return null;
  return echeanceLocale - maintenantMs;
}
