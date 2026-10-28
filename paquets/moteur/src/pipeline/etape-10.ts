// Étape 10 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[9] :
//
//   pour tout joueur de rôle MARCHAND_EPICES :
//   +bonus_marchand_epices_par_voeu_reussi.
//
// Condition : reussi
//
// Le rôle est SECRET : EvtExecutionResultat ne porte que bonus_epices_verse,
// un booléen qui dit qu'au moins un marchand d'épices a touché son bonus, sans
// jamais nommer qui. Chaque bénéficiaire l'apprend par son canal privé de solde.

import { appliquerMouvements } from '../etat/mouvements.ts';
import { avecJoueursTouches, type ContexteExecution } from './contexte.ts';

export function etape10(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  const bonus = contexte.etat.config.bonus_marchand_epices_par_voeu_reussi;
  if (bonus === 0) return contexte;
  const beneficiaires = contexte.etat.joueurs
    .filter((joueur) => joueur.role_secret === 'MARCHAND_EPICES')
    .map((joueur) => joueur.id);
  if (beneficiaires.length === 0) return contexte;

  const etat = appliquerMouvements(
    contexte.etat,
    beneficiaires.map((id) => ({
      joueur_id: id,
      delta: bonus,
      motif: 'bonus_epices' as const,
      manche_numero: contexte.numero,
    })),
    contexte.ecriture,
  );
  return { ...avecJoueursTouches(contexte, etat, beneficiaires), bonus_epices_verse: true };
}

export type Etape10 = typeof etape10;
