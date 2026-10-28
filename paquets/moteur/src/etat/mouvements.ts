// Journal de pièces — RG-41 / RG-42 / CA-32.
//
// TOUT changement de solde passe par ici, et par rien d'autre. C'est la seule
// façon de garantir mécaniquement les deux invariants :
//   RG-41 : aucun solde ne devient négatif, à aucun instant ;
//   RG-42 : pour tout joueur, solde = somme de ses mouvements.
//
// Un solde écrit directement dans l'état serait un trou dans l'auditabilité et
// rendrait CA-32 infalsifiable : la fonction ci-dessous refuse donc tout delta
// qui passerait un solde sous zéro, plutôt que de le corriger silencieusement.

import type { MotifMouvement } from '@gdv/partage';

import { avecJoueur, exigerJoueur } from './acces.ts';
import type { EtatSession, Mouvement } from './types.ts';

export interface DemandeMouvement {
  readonly joueur_id: string;
  readonly delta: number;
  readonly motif: MotifMouvement;
  readonly contrepartie_joueur_id?: string | null;
  readonly manche_numero?: number | null;
}

export interface ContexteEcriture {
  readonly identifiant: () => string;
  readonly maintenant: number;
}

function sequenceSuivante(etat: EtatSession, joueurId: string): number {
  const sequences = etat.mouvements
    .filter((mouvement) => mouvement.joueur_id === joueurId)
    .map((mouvement) => mouvement.sequence);
  return sequences.length === 0 ? 1 : Math.max(...sequences) + 1;
}

/**
 * Applique un mouvement : met à jour le solde ET écrit la ligne de journal,
 * dans la même opération. Un delta nul est refusé (CHECK(delta <> 0) en base) :
 * une ligne sans effet encombre l'audit sans rien prouver.
 */
export function appliquerMouvement(
  etat: EtatSession,
  demande: DemandeMouvement,
  contexte: ContexteEcriture,
): EtatSession {
  if (demande.delta === 0) {
    throw new Error(`Mouvement de delta nul refusé (motif ${demande.motif})`);
  }
  const joueur = exigerJoueur(etat, demande.joueur_id);
  const soldeApres = joueur.solde_pieces + demande.delta;
  if (soldeApres < 0) {
    throw new Error(
      `RG-41 violée : le solde de ${demande.joueur_id} passerait à ${soldeApres} ` +
        `(motif ${demande.motif}). Un prélèvement involontaire doit être plafonné ` +
        `au solde, un acte volontaire refusé a priori.`,
    );
  }

  const mouvement: Mouvement = {
    id: contexte.identifiant(),
    joueur_id: demande.joueur_id,
    manche_numero: demande.manche_numero ?? null,
    delta: demande.delta,
    motif: demande.motif,
    contrepartie_joueur_id: demande.contrepartie_joueur_id ?? null,
    solde_apres: soldeApres,
    sequence: sequenceSuivante(etat, demande.joueur_id),
    cree_at: contexte.maintenant,
  };

  const avecSolde = avecJoueur(etat, { ...joueur, solde_pieces: soldeApres });
  return { ...avecSolde, mouvements: [...avecSolde.mouvements, mouvement] };
}

/** Applique une suite de mouvements dans l'ordre donné. L'ordre est normatif. */
export function appliquerMouvements(
  etat: EtatSession,
  demandes: readonly DemandeMouvement[],
  contexte: ContexteEcriture,
): EtatSession {
  let courant = etat;
  for (const demande of demandes) {
    if (demande.delta === 0) continue;
    courant = appliquerMouvement(courant, demande, contexte);
  }
  return courant;
}

/**
 * Transfert symétrique : exactement deux lignes, écrites ensemble.
 * Le montant est plafonné au solde du débiteur par l'appelant ; ici, un montant
 * supérieur au solde échoue, parce qu'un transfert partiel silencieux ferait
 * mentir le journal.
 */
export function transferer(
  etat: EtatSession,
  parametres: {
    readonly de: string;
    readonly vers: string;
    readonly montant: number;
    readonly motif_debit: MotifMouvement;
    readonly motif_credit: MotifMouvement;
    readonly manche_numero?: number | null;
  },
  contexte: ContexteEcriture,
): EtatSession {
  if (parametres.montant === 0) return etat;
  return appliquerMouvements(
    etat,
    [
      {
        joueur_id: parametres.de,
        delta: -parametres.montant,
        motif: parametres.motif_debit,
        contrepartie_joueur_id: parametres.vers,
        manche_numero: parametres.manche_numero ?? null,
      },
      {
        joueur_id: parametres.vers,
        delta: parametres.montant,
        motif: parametres.motif_credit,
        contrepartie_joueur_id: parametres.de,
        manche_numero: parametres.manche_numero ?? null,
      },
    ],
    contexte,
  );
}
