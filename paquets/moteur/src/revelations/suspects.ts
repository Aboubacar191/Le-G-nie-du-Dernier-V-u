// Ensemble des suspects publics — RG-23, loi 2 du génie (RG-21).
//
// « ensemble_suspects_publics = joueurs de la session dont le statut
//   d'honnêteté sur la manche courante n'est pas déterminé par la seule
//   information publique. Un joueur en sort lorsqu'il est (a) exonéré par une
//   révélation d'exonération, (b) démasqué par une accusation de verdict
//   MENTEUR, ou (c) déclaré honnête par une accusation de verdict HONNETE. »
//
// L'ensemble est recalculé à chaque émission et journalisé dans
// suspects_restants_apres. Il n'est JAMAIS émis comme liste : seule sa
// cardinalité sort, dans EvtRevelation.suspects_restants.
//
// ANO-04, BLOQUANTE — LA CLAUSE GÉNÉRALE PRIME SUR LA LISTE FERMÉE QUI LA SUIT.
// Jusqu'ici, seuls (a), (b) et (c) étaient implémentés, c'est-à-dire la liste
// des trois motifs explicites. Or la définition commence par une clause
// GÉNÉRALE — « dont le statut d'honnêteté n'est pas déterminé par la seule
// information publique » — et les trois motifs n'en sont que des EXEMPLES. Le
// QA l'a mesuré : suspects_restants journalisé à 6 alors qu'une COMPARAISON
// venait de démasquer J5 par inférence, soit 5 au plus.
//
// L'INFÉRENCE EST DÉCIDABLE, et c'est ce qui la rend implémentable. RG-09 borne
// le paiement par la déclaration — payer plus que déclaré est refusé — donc
// payé(x) <= déclaré(x) pour tout joueur, et c'est une information PUBLIQUE
// puisque RG-31 publie les déclarations à leur soumission. Si une COMPARAISON
// « a a payé plus que b » a été émise avec déclaré(a) <= déclaré(b), alors
//
//     payé(b) < payé(a) <= déclaré(a) <= déclaré(b)
//
// donc b a menti, avec certitude, pour n'importe quel observateur. Aucune
// énumération des répartitions compatibles n'est nécessaire.

import { declareDe } from '../etat/acces.ts';
import type { EtatSession, Manche } from '../etat/types.ts';

const GABARIT_EXONERATION = 'EXONERATION';
const GABARIT_COMPARAISON = 'COMPARAISON';

/**
 * Le menteur que « a a payé plus que b » détermine, s'il y en a un.
 *
 * Exporté parce que la GARDE d'éligibilité pose exactement la même question
 * avant d'émettre un candidat (eligibilite.ts) : deux implémentations de ce
 * prédicat seraient deux occasions de divergence, et c'est la divergence qui a
 * produit ANO-04 — la garde raisonnait sur une paire, le dénombrement sur une
 * liste fermée, et aucune des deux ne lisait la clause générale.
 */
export function menteurDetermineParComparaison(
  manche: Manche,
  a: string,
  b: string,
): string | null {
  return declareDe(manche, a) <= declareDe(manche, b) ? b : null;
}

/** Joueurs sortis de l'ensemble des suspects, avec le motif de sortie en commentaire. */
function sortis(manche: Manche): ReadonlySet<string> {
  const hors = new Set<string>();
  for (const revelation of manche.revelations) {
    // (a) exonérés par une révélation d'exonération déjà émise sur cette manche
    if (revelation.gabarit === GABARIT_EXONERATION) {
      for (const cible of revelation.cibles) hors.add(cible);
    }
    // CLAUSE GÉNÉRALE : démasqués par INFÉRENCE depuis une comparaison émise.
    if (revelation.gabarit === GABARIT_COMPARAISON) {
      const [a, b] = revelation.cibles;
      const determine =
        a === undefined || b === undefined ? null : menteurDetermineParComparaison(manche, a, b);
      if (determine !== null) hors.add(determine);
    }
  }
  // (b) et (c) : l'accusé d'une accusation résolue, quel que soit le verdict —
  // MENTEUR le démasque, HONNETE le déclare honnête ; dans les deux cas son
  // statut est déterminé par la seule information publique.
  for (const accusation of manche.accusations) hors.add(accusation.accuse_joueur_id);
  return hors;
}

/** Suspects publics de la manche, dans l'ordre d'arrivée des joueurs. */
export function suspectsPublics(etat: EtatSession, manche: Manche): readonly string[] {
  const hors = sortis(manche);
  return etat.joueurs.map((joueur) => joueur.id).filter((id) => !hors.has(id));
}

/** Cardinalité après retrait éventuel de cibles exonérées par l'émission à venir. */
export function suspectsApresEmission(
  etat: EtatSession,
  manche: Manche,
  ciblesExonerees: readonly string[],
): number {
  const retires = new Set(ciblesExonerees);
  return suspectsPublics(etat, manche).filter((id) => !retires.has(id)).length;
}
