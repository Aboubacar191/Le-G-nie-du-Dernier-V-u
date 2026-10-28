// Fin de partie : clôture de manche, Dernier Vœu, scores, terminaison, abandon.
//
// RG-76 : un abandon ne révèle AUCUN secret. Il n'y a donc PAS de chemin de
// ABANDONNEE vers l'écran de scores : abandonner() ne calcule aucun classement
// et n'émet aucune donnée secrète. C'est une faille de conception que le
// designer a relevée au nœud S2 — si l'abandon divulguait, l'hôte disposerait
// d'un moyen unilatéral de forcer la révélation des secrets de toute la table.

import type { MotifAbandon } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import type { ContexteMoteur, EtatSession, SignatureDernierVoeu } from '../etat/types.ts';
import { calculerClassement } from '../scores/classement.ts';
import { resoudreDernierVoeu } from '../scores/dernier-voeu.ts';
import { ecritureDe, ouvrirManche, type Transition } from './flux.ts';
import { finDePhase } from './manche.ts';

/** Entrée dans le mode avancé : une ligne de signature par joueur, non soumise. */
function signaturesVierges(etat: EtatSession, maintenant: number): readonly SignatureDernierVoeu[] {
  return etat.joueurs.map((joueur) => ({
    joueur_id: joueur.id,
    a_signe: null,
    cree_at: maintenant,
  }));
}

export function entrerEnDernierVoeu(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const maintenant = contexte.horloge.maintenant();
  const avance: EtatSession = {
    ...etat,
    etat_partie: 'DERNIER_VOEU',
    phase: 'DV_PROPOSITION',
    phase_fin_at: finDePhase('DV_PROPOSITION', etat.config, maintenant),
    signatures: signaturesVierges(etat, maintenant),
  };
  const propositions: Effet[] = avance.joueurs.map((joueur) => ({
    type: 'dernier_voeu_propose',
    joueur_id: joueur.id,
  }));
  return {
    etat: avance,
    effets: [{ type: 'etat_partie_change' }, { type: 'phase_changee' }, ...propositions],
  };
}

export function entrerEnScores(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const classement = calculerClassement({ ...etat, etat_partie: 'SCORES', phase: null, phase_fin_at: null });
  void contexte;
  return { etat: classement.etat, effets: [{ type: 'etat_partie_change' }, { type: 'scores_finaux' }] };
}

/**
 * Résolution du Dernier Vœu, puis passage aux scores.
 * RG-53 : une signature non soumise à l'expiration vaut REFUS.
 */
export function resoudreEtScorer(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const soumises: EtatSession = {
    ...etat,
    phase: 'DV_RESOLUTION',
    signatures: etat.signatures.map((signature) => ({
      ...signature,
      a_signe: signature.a_signe ?? false,
    })),
  };
  const resolution = resoudreDernierVoeu(soumises, ecritureDe(contexte));
  const soldes: Effet[] = resolution.joueurs_touches.map((joueur_id) => ({
    type: 'solde_mis_a_jour',
    joueur_id,
  }));
  const scores = entrerEnScores(resolution.etat, contexte);
  return {
    etat: scores.etat,
    effets: [
      {
        type: 'dernier_voeu_resolu',
        nb_signataires: resolution.nb_signataires,
        consequence: resolution.consequence,
        genie_libere: resolution.genie_libere,
      },
      ...soldes,
      ...scores.effets,
    ],
  };
}

/**
 * Ce qui suit la clôture d'une manche : la manche suivante, le Dernier Vœu, ou
 * les scores (machine_etats_partie).
 */
export function apresCloture(etat: EtatSession, contexte: ContexteMoteur): Transition {
  if (etat.manche_courante < etat.config.nb_manches) {
    return ouvrirManche(etat, etat.manche_courante + 1, contexte);
  }
  if (etat.mode_avance_actif) return entrerEnDernierVoeu(etat, contexte);
  return entrerEnScores({ ...etat, genie_libere: null }, contexte);
}

/** La partie doit-elle être clôturée ? SCORES → TERMINEE est automatique. */
export function doitCloturer(etat: EtatSession): boolean {
  return etat.etat_partie === 'SCORES';
}

/**
 * Passage en TERMINEE : seul moment où le compteur du groupe est incrémenté
 * (RG-59, CA-48). L'événement de groupe part vers le seul hôte.
 */
export function cloturerPartie(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const partiesTerminees = etat.groupe.parties_terminees + 1;
  return {
    etat: {
      ...etat,
      etat_partie: 'TERMINEE',
      termine_le: contexte.horloge.maintenant(),
      groupe: { ...etat.groupe, parties_terminees: partiesTerminees },
    },
    effets: [{ type: 'etat_partie_change' }, { type: 'groupe_mis_a_jour' }],
  };
}

/** Abandon : terminal, irréversible, et SANS récompense informationnelle (RG-76). */
export function abandonner(
  etat: EtatSession,
  motif: MotifAbandon,
  contexte: ContexteMoteur,
): Transition {
  return {
    etat: {
      ...etat,
      etat_partie: 'ABANDONNEE',
      phase: null,
      phase_fin_at: null,
      termine_le: contexte.horloge.maintenant(),
    },
    effets: [
      { type: 'etat_partie_change' },
      { type: 'partie_abandonnee', motif_abandon: motif },
    ],
  };
}
