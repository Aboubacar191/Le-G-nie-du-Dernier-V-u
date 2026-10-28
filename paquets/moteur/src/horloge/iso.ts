// Horodatage ISO 8601 UTC sans jamais toucher à Date.
//
// Date, Date.now et new Date sont bannis du paquet moteur par règle ESLint
// (ADR-TL-08, RG-72). Le format du fil est pourtant imposé : « ISO 8601,
// toujours UTC, suffixe Z obligatoire » (API / Horodatage). La conversion est
// donc écrite en arithmétique entière, donc pure, donc identique sur toute
// machine et dans tout fuseau — ce qu'un appel à Date ne garantit pas.
//
// Algorithme de calendrier grégorien proleptique de Howard Hinnant
// (civil_from_days), transcrit en divisions entières. Toutes ses constantes
// sont nommées : no-magic-numbers n'admet ici que 0 et 1.

const MS_PAR_SECONDE = 1000;
const SECONDES_PAR_MINUTE = 60;
const MINUTES_PAR_HEURE = 60;
const HEURES_PAR_JOUR = 24;
const MS_PAR_MINUTE = MS_PAR_SECONDE * SECONDES_PAR_MINUTE;
const MS_PAR_HEURE = MS_PAR_MINUTE * MINUTES_PAR_HEURE;
const MS_PAR_JOUR = MS_PAR_HEURE * HEURES_PAR_JOUR;

const DECALAGE_ERE = 719468;
const JOURS_PAR_ERE = 146097;
const DERNIER_JOUR_ERE = 146096;
const ANNEES_PAR_ERE = 400;
const JOURS_PAR_ANNEE = 365;
const JOURS_QUADRIENNAUX = 1460;
const JOURS_CENTENAIRES = 36524;
const DIVISEUR_BISSEXTILE = 4;
const DIVISEUR_SIECLE = 100;
const PENTE_MOIS = 5;
const OFFSET_MOIS = 2;
const PAS_MOIS = 153;
const MOIS_PIVOT = 10;
const DECALAGE_MOIS_AVANT = 3;
const DECALAGE_MOIS_APRES = -9;
const MOIS_FEVRIER = 2;

const LARGEUR_ANNEE = 4;
const LARGEUR_DEUX = 2;
const LARGEUR_MS = 3;

function divise(numerateur: number, denominateur: number): number {
  return Math.floor(numerateur / denominateur);
}

export interface DateCivile {
  readonly annee: number;
  readonly mois: number;
  readonly jour: number;
}

/** Date civile UTC depuis un nombre de jours écoulés depuis l'époque Unix. */
export function dateCivile(jours: number): DateCivile {
  const z = jours + DECALAGE_ERE;
  const ere = divise(z, JOURS_PAR_ERE);
  const jourDansEre = z - ere * JOURS_PAR_ERE;
  const anneeDansEre = divise(
    jourDansEre -
      divise(jourDansEre, JOURS_QUADRIENNAUX) +
      divise(jourDansEre, JOURS_CENTENAIRES) -
      divise(jourDansEre, DERNIER_JOUR_ERE),
    JOURS_PAR_ANNEE,
  );
  const anneeBrute = anneeDansEre + ere * ANNEES_PAR_ERE;
  const jourDansAnnee =
    jourDansEre -
    (JOURS_PAR_ANNEE * anneeDansEre +
      divise(anneeDansEre, DIVISEUR_BISSEXTILE) -
      divise(anneeDansEre, DIVISEUR_SIECLE));
  const moisPivot = divise(PENTE_MOIS * jourDansAnnee + OFFSET_MOIS, PAS_MOIS);
  const jour = jourDansAnnee - divise(PAS_MOIS * moisPivot + OFFSET_MOIS, PENTE_MOIS) + 1;
  const mois = moisPivot + (moisPivot < MOIS_PIVOT ? DECALAGE_MOIS_AVANT : DECALAGE_MOIS_APRES);
  const annee = mois <= MOIS_FEVRIER ? anneeBrute + 1 : anneeBrute;
  return { annee, mois, jour };
}

function pad(valeur: number, largeur: number): string {
  return String(valeur).padStart(largeur, '0');
}

/**
 * Millisecondes depuis l'époque Unix → « 2026-10-27T18:40:00.000Z ».
 * Le suffixe Z est écrit en dur dans le format : aucun fuseau local n'entre ici.
 */
export function versIso(ms: number): string {
  const jours = divise(ms, MS_PAR_JOUR);
  const resteJour = ms - jours * MS_PAR_JOUR;
  const { annee, mois, jour } = dateCivile(jours);
  const heures = divise(resteJour, MS_PAR_HEURE);
  const minutes = divise(resteJour - heures * MS_PAR_HEURE, MS_PAR_MINUTE);
  const secondes = divise(
    resteJour - heures * MS_PAR_HEURE - minutes * MS_PAR_MINUTE,
    MS_PAR_SECONDE,
  );
  const millisecondes = resteJour - heures * MS_PAR_HEURE - minutes * MS_PAR_MINUTE - secondes * MS_PAR_SECONDE;
  return (
    `${pad(annee, LARGEUR_ANNEE)}-${pad(mois, LARGEUR_DEUX)}-${pad(jour, LARGEUR_DEUX)}` +
    `T${pad(heures, LARGEUR_DEUX)}:${pad(minutes, LARGEUR_DEUX)}:${pad(secondes, LARGEUR_DEUX)}` +
    `.${pad(millisecondes, LARGEUR_MS)}Z`
  );
}
