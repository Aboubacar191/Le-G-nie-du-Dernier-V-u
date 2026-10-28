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

import type { EtatSession, Manche } from '../etat/types.ts';

const GABARIT_EXONERATION = 'EXONERATION';

/** Joueurs sortis de l'ensemble des suspects, avec le motif de sortie en commentaire. */
function sortis(manche: Manche): ReadonlySet<string> {
  const hors = new Set<string>();
  // (a) exonérés par une révélation d'exonération déjà émise sur cette manche
  for (const revelation of manche.revelations) {
    if (revelation.gabarit !== GABARIT_EXONERATION) continue;
    for (const cible of revelation.cibles) hors.add(cible);
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
