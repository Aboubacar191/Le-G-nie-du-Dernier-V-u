// Sélection et émission d'une révélation — lois 1, 2 et 3 du génie.
//
// Loi 3 (RG-22) : « à éligibilité égale, le génie cible le joueur au plus haut
// score d'activité ». Les gabarits sans cible — COMPTAGE, PASSE — n'ont pas de
// tension mesurable au sens de RG-24 : leur score vaut 0.
//
// RG-24, départage : « en cas d'égalité — notamment à la manche 1 où le score
// est nul pour tous — la cible est tirée UNIFORMÉMENT par la source d'aléa
// injectée, dont la position ne dépend d'aucun acte secret ». Un départage
// déterministe (ordre du catalogue, puis identifiants) serait lui-même un
// canal : à tension égale, il favoriserait toujours la même cible, et un tiers
// qui connaît le catalogue pourrait deviner lequel des candidats a été retenu
// avant même de lire la révélation. Puisque la tension ne dépend plus que des
// accusations (PUBLIQUES, voir score-activite.ts), le fait même qu'il y ait ou
// non égalité n'est jamais une fonction d'un acte secret.
//
// Loi 1 (RG-20) : l'énoncé retenu est REVÉRIFIÉ par verifierEnonce, écrite dans
// un module distinct qui ne partage aucun code avec la sélection. Si la
// revérification échoue, RIEN n'est émis — le génie ne se rabat pas sur un
// autre énoncé, ce qui ferait de la revérification un simple filtre.

import type { Alea } from '../alea/interface.ts';
import { trouverJoueur } from '../etat/acces.ts';
import type { EtatSession, Manche, RevelationEmise } from '../etat/types.ts';
import { candidatsEligibles, type CandidatRevelation } from './eligibilite.ts';
import { verifierEnonce } from './verification.ts';

/**
 * RG-25 : chaque gabarit porte AU MOINS 2 formulations alternatives. Le moteur
 * ignore le contenu éditorial (il vit côté client, RG-61) : il tire donc parmi
 * les deux variantes que la règle garantit. Le client se rabat sur l'index 0
 * s'il ne connaît pas l'index reçu (API-GDV-001 / RevelationPublique).
 */
const NOMBRE_VARIANTES_FORMULATION = 2;

function tensionDe(etat: EtatSession, candidat: CandidatRevelation): number {
  let maximum = 0;
  for (const cible of candidat.cibles) {
    const score = trouverJoueur(etat, cible)?.score_activite ?? 0;
    if (score > maximum) maximum = score;
  }
  return maximum;
}

/**
 * RG-24 : tension décroissante, puis tirage UNIFORME par l'aléa injecté parmi
 * les candidats à la tension maximale — jamais un ordre fixe. L'ordre de
 * `candidats` lui-même (celui de `candidatsEligibles`) n'influence le résultat
 * qu'à travers ce tirage, jamais par position.
 */
export function selectionnerRevelation(
  etat: EtatSession,
  manche: Manche,
  alea: Alea,
): CandidatRevelation | null {
  const candidats = [...candidatsEligibles(etat, manche)];
  if (candidats.length === 0) return null;
  let meilleurs = [candidats[0]!];
  let tensionMax = tensionDe(etat, candidats[0]!);
  for (const candidat of candidats.slice(1)) {
    const tension = tensionDe(etat, candidat);
    if (tension > tensionMax) {
      meilleurs = [candidat];
      tensionMax = tension;
    } else if (tension === tensionMax) {
      meilleurs.push(candidat);
    }
  }
  if (meilleurs.length === 1) return meilleurs[0]!;
  return meilleurs[alea.entier(0, meilleurs.length - 1)]!;
}

export interface EmissionRevelation {
  readonly etat: EtatSession;
  readonly revelation: RevelationEmise;
}

/**
 * Émet AU PLUS une révélation du catalogue pour la manche.
 * Rend null si aucun gabarit n'est éligible (CA-15) ou si la revérification
 * indépendante échoue : dans les deux cas, seul l'écart total a été publié.
 */
export function emettreRevelation(
  etat: EtatSession,
  manche: Manche,
  contexte: {
    readonly alea: Alea;
    readonly maintenant: number;
    readonly identifiant: () => string;
  },
): EmissionRevelation | null {
  const candidat = selectionnerRevelation(etat, manche, contexte.alea);
  if (candidat === null) return null;

  const variante = contexte.alea.entier(0, NOMBRE_VARIANTES_FORMULATION - 1);
  const revelation: RevelationEmise = {
    id: contexte.identifiant(),
    gabarit: candidat.gabarit,
    variante_formulation: variante,
    cibles: candidat.cibles,
    valeurs: candidat.valeurs,
    suspects_restants_apres: candidat.suspects_restants_apres,
    verifiee_vraie: verifierEnonce(etat, manche, candidat),
    emise_at: contexte.maintenant,
  };

  // CHECK(verifiee_vraie = 1) est gravé en base : une révélation non vérifiée
  // ne peut pas être écrite, donc pas émise (RG-20).
  if (!revelation.verifiee_vraie) return null;

  const mancheMaj: Manche = { ...manche, revelations: [...manche.revelations, revelation] };
  return {
    revelation,
    etat: {
      ...etat,
      manches: etat.manches.map((m) => (m.numero === manche.numero ? mancheMaj : m)),
    },
  };
}
