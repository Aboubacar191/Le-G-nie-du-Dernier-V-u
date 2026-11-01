// Éligibilité des gabarits de révélation — catalogue_revelations de la SPEC.
//
// ECART_TOTAL n'est PAS ici : il est émis systématiquement, hors catalogue de
// sélection. Ce module ne produit que des candidats du catalogue, chacun déjà
// filtré par la loi 2 (RG-21) : au moins MINIMUM_SUSPECTS_PUBLICS suspects
// APRÈS émission. Une valeur inférieure n'est donc pas produite, et pas
// seulement rejetée en sortie — c'est ce que demande la mission : « une valeur
// inférieure doit être impossible à produire, pas filtrée ».

import { MINIMUM_SUSPECTS_PUBLICS, type Gabarit } from '@gdv/partage';

import { declareDe, payeDe, voisinsDe } from '../etat/acces.ts';
import type { EtatSession, Manche } from '../etat/types.ts';
import {
  menteurDetermineParComparaison,
  suspectsApresEmission,
  suspectsPublics,
} from './suspects.ts';

export interface CandidatRevelation {
  readonly gabarit: Gabarit;
  readonly cibles: readonly string[];
  readonly valeurs: Readonly<Record<string, number>>;
  readonly suspects_restants_apres: number;
}

/** Joueurs ayant menti sur la manche : montant_declare − montant_paye > 0 (RG-11). */
export function menteursDe(etat: EtatSession, manche: Manche): readonly string[] {
  return etat.joueurs
    .map((joueur) => joueur.id)
    .filter((id) => declareDe(manche, id) - payeDe(manche, id) > 0);
}

function sansExoneration(etat: EtatSession, manche: Manche): number {
  return suspectsApresEmission(etat, manche, []);
}

// --- COMPTAGE : « {k} d'entre vous ont menti. » ------------------------------
// Éligible si 1 <= k <= nb_joueurs − 1. Interdit à k == 0 (révélerait
// l'honnêteté de tous) et à k == nb_joueurs (la culpabilité de tous).
function candidatsComptage(etat: EtatSession, manche: Manche): readonly CandidatRevelation[] {
  const k = menteursDe(etat, manche).length;
  const restants = sansExoneration(etat, manche);
  if (k < 1 || k > etat.joueurs.length - 1) return [];
  if (restants < MINIMUM_SUSPECTS_PUBLICS) return [];
  return [{ gabarit: 'COMPTAGE', cibles: [], valeurs: { k }, suspects_restants_apres: restants }];
}

// --- VOISINAGE : « Un menteur est assis à côté de {cible}. » -----------------
// Éligible si au moins un des deux voisins cycliques de la cible a menti. La
// cible n'est ni accusée ni exonérée par l'énoncé : elle reste suspecte.
function candidatsVoisinage(etat: EtatSession, manche: Manche): readonly CandidatRevelation[] {
  const restants = sansExoneration(etat, manche);
  if (restants < MINIMUM_SUSPECTS_PUBLICS) return [];
  const menteurs = new Set(menteursDe(etat, manche));
  return etat.joueurs
    .filter((joueur) => voisinsDe(etat, joueur.id).some((voisin) => menteurs.has(voisin)))
    .map((joueur) => ({
      gabarit: 'VOISINAGE' as const,
      cibles: [joueur.id],
      valeurs: {},
      suspects_restants_apres: restants,
    }));
}

// --- EXONERATION : « {cible} a payé ce qu'il a promis. » ---------------------
// Éligible si la cible n'a pas menti ET s'il reste au moins
// MINIMUM_SUSPECTS_PUBLICS suspects APRÈS son retrait.
function candidatsExoneration(etat: EtatSession, manche: Manche): readonly CandidatRevelation[] {
  const menteurs = new Set(menteursDe(etat, manche));
  const suspects = suspectsPublics(etat, manche);
  return suspects
    .filter((id) => !menteurs.has(id))
    .map((id) => ({
      gabarit: 'EXONERATION' as const,
      cibles: [id],
      valeurs: {},
      suspects_restants_apres: suspectsApresEmission(etat, manche, [id]),
    }))
    .filter((candidat) => candidat.suspects_restants_apres >= MINIMUM_SUSPECTS_PUBLICS);
}

// --- COMPARAISON : « {a} a payé plus que {b}. » ------------------------------
/**
 * SPEC 1.4.1, catalogue_revelations.gabarits / COMPARAISON : « Interdit si
 * l'énoncé désigne un menteur unique, au sens FORMEL suivant, et pas au sens
 * d'une appréciation : la désignation est unique exactement quand l'ensemble des
 * suspects publics après émission se réduit à la paire {a, b} ET qu'un seul des
 * deux a menti. »
 *
 * Cette formalisation est celle de la SPEC et elle est conservée telle quelle.
 * Elle ne suffisait PAS : à 6 suspects, les cinq candidats de la manche
 * nommaient un menteur et passaient tous (ANO-04, bloquante, mesurée). C'est le
 * second prédicat, l'inférence par les déclarations, qui ferme la fuite ; les
 * deux sont appliqués, et aucun ne remplace l'autre.
 */
function designeUnMenteurUnique(
  etat: EtatSession,
  manche: Manche,
  a: string,
  b: string,
): boolean {
  const suspects = suspectsPublics(etat, manche);
  if (suspects.length !== MINIMUM_SUSPECTS_PUBLICS) return false;
  if (!suspects.includes(a) || !suspects.includes(b)) return false;
  const menteurs = new Set(menteursDe(etat, manche));
  const nbMenteursDeLaPaire = [a, b].filter((id) => menteurs.has(id)).length;
  return nbMenteursDeLaPaire === 1;
}

function candidatsComparaison(etat: EtatSession, manche: Manche): readonly CandidatRevelation[] {
  const restants = sansExoneration(etat, manche);
  if (restants < MINIMUM_SUSPECTS_PUBLICS) return [];
  const candidats: CandidatRevelation[] = [];
  for (const a of etat.joueurs) {
    for (const b of etat.joueurs) {
      if (a.id === b.id) continue;
      if (payeDe(manche, a.id) <= payeDe(manche, b.id)) continue;
      if (designeUnMenteurUnique(etat, manche, a.id, b.id)) continue;
      // CLAUSE GÉNÉRALE DE RG-23, et c'est le correctif de ANO-04 : si
      // déclaré(a) <= déclaré(b), l'énoncé DÉTERMINE que b a menti — par
      // payé(b) < payé(a) <= déclaré(a) <= déclaré(b), RG-09 bornant le
      // paiement par la déclaration. Le candidat nomme donc un menteur, ce que
      // la troisième loi du génie interdit, et il sort de l'ensemble des
      // suspects, ce que la deuxième loi compte. Le candidat n'est pas filtré
      // en sortie : il n'est jamais PRODUIT.
      if (menteurDetermineParComparaison(manche, a.id, b.id) !== null) continue;
      candidats.push({
        gabarit: 'COMPARAISON',
        cibles: [a.id, b.id],
        valeurs: {},
        suspects_restants_apres: restants,
      });
    }
  }
  return candidats;
}

// --- PASSE : « L'un de vous ment depuis la première manche. » ----------------
// Disponible à partir de manche_min_revelation_passe (RG-45), et seulement si
// au moins un joueur a menti à CHACUNE des manches 1..numero_manche.
export function menteursDepuisLaPremiere(etat: EtatSession, numero: number): readonly string[] {
  const manches = etat.manches.filter((manche) => manche.numero <= numero);
  if (manches.length === 0) return [];
  return etat.joueurs
    .map((joueur) => joueur.id)
    .filter((id) =>
      manches.every((manche) => declareDe(manche, id) - payeDe(manche, id) > 0),
    );
}

function candidatsPasse(etat: EtatSession, manche: Manche): readonly CandidatRevelation[] {
  if (manche.numero < etat.config.manche_min_revelation_passe) return [];
  if (menteursDepuisLaPremiere(etat, manche.numero).length < 1) return [];
  const restants = sansExoneration(etat, manche);
  if (restants < MINIMUM_SUSPECTS_PUBLICS) return [];
  return [{ gabarit: 'PASSE', cibles: [], valeurs: {}, suspects_restants_apres: restants }];
}

/** Tous les candidats éligibles du catalogue, dans l'ordre des gabarits de la SPEC. */
export function candidatsEligibles(
  etat: EtatSession,
  manche: Manche,
): readonly CandidatRevelation[] {
  return [
    ...candidatsComptage(etat, manche),
    ...candidatsVoisinage(etat, manche),
    ...candidatsExoneration(etat, manche),
    ...candidatsComparaison(etat, manche),
    ...candidatsPasse(etat, manche),
  ];
}
