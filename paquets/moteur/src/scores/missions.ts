// Évaluation des missions secrètes — catalogue_missions de la SPEC.
//
// Le garde-fou de réglage du GDD (« une mission ne doit être réussie ni dans
// moins de 20 % ni dans plus de 50 % des parties ») est un objectif de réglage
// FUTUR, pas une règle à implémenter : le moteur ne force et ne filtre AUCUN
// résultat de mission. Il évalue, et c'est tout.
//
// Les seuils 2, 4 et 2 appartiennent aux énoncés de condition_testable des
// missions, pas à l'équilibrage paramétrable : ils sont nommés ici et lus
// nulle part ailleurs.

import type { Mission } from '@gdv/partage';

import { declareDe, payeDe } from '../etat/acces.ts';
import type { EtatSession } from '../etat/types.ts';

const SEUIL_FAUSSAIRE_MANCHES_MENTIES = 2;
const SEUIL_JUSTICIER_CIBLES_DISTINCTES = 2;
const SEUIL_BATISSEUR_MANCHES_REUSSIES = 4;
const SEUIL_SABOTEUR_MANCHES_ECHOUEES = 2;

function manchesMenties(etat: EtatSession, joueurId: string): number {
  return etat.manches.filter(
    (manche) => declareDe(manche, joueurId) - payeDe(manche, joueurId) > 0,
  ).length;
}

function demasqueAuMoinsUneFois(etat: EtatSession, joueurId: string): boolean {
  return etat.manches.some((manche) =>
    manche.accusations.some(
      (accusation) =>
        accusation.accuse_joueur_id === joueurId && accusation.verdict === 'MENTEUR',
    ),
  );
}

function ciblesDemasqueesPar(etat: EtatSession, joueurId: string): number {
  const cibles = new Set<string>();
  for (const manche of etat.manches) {
    for (const accusation of manche.accusations) {
      if (accusation.accusateur_joueur_id !== joueurId) continue;
      if (accusation.verdict !== 'MENTEUR') continue;
      cibles.add(accusation.accuse_joueur_id);
    }
  }
  return cibles.size;
}

function manchesAvecReussite(etat: EtatSession, reussi: boolean): number {
  return etat.manches.filter((manche) => manche.cloture && manche.reussi === reussi).length;
}

/**
 * LE_MAGNAT est évalué sur les pièces RESTANTES, après résolution du Dernier
 * Vœu et AVANT l'ajout des bonus de mission (catalogue_missions). Les ex aequo
 * réussissent tous.
 */
function estMagnat(etat: EtatSession, joueurId: string): boolean {
  const soldes = etat.joueurs.map((joueur) => joueur.solde_pieces);
  if (soldes.length === 0) return false;
  const maximum = Math.max(...soldes);
  return etat.joueurs.some(
    (joueur) => joueur.id === joueurId && joueur.solde_pieces === maximum,
  );
}

/** Mission réussie ? Rend false pour un joueur sans mission (MARCHAND_DEJA_LIE, RG-51). */
export function missionReussie(
  etat: EtatSession,
  joueurId: string,
  mission: Mission | null,
): boolean {
  if (mission === null) return false;
  switch (mission) {
    case 'LE_MAGNAT':
      return estMagnat(etat, joueurId);
    case 'LE_FAUSSAIRE':
      return (
        manchesMenties(etat, joueurId) >= SEUIL_FAUSSAIRE_MANCHES_MENTIES &&
        !demasqueAuMoinsUneFois(etat, joueurId)
      );
    case 'LE_JUSTICIER':
      return ciblesDemasqueesPar(etat, joueurId) >= SEUIL_JUSTICIER_CIBLES_DISTINCTES;
    case 'LE_BATISSEUR':
      return manchesAvecReussite(etat, true) >= SEUIL_BATISSEUR_MANCHES_REUSSIES;
    case 'LE_SABOTEUR':
      return manchesAvecReussite(etat, false) >= SEUIL_SABOTEUR_MANCHES_ECHOUEES;
    case 'GARDIEN_DE_LA_LAMPE':
      // RG-52 : +bonus si le génie n'est PAS libéré. Un génie dont le sort n'est
      // pas tranché (partie hors mode avancé) ne fait pas réussir la mission.
      return etat.genie_libere === false;
  }
}
