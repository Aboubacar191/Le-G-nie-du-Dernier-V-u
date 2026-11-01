// Commandes de la phase NEGOCIATION : transferts et prêts.
//
// Rien de tout cela n'est public : « publier les transferts permettrait de
// recouper les soldes et de remonter aux paiements » (matrice_visibilite), et
// publier un prêt révélerait en plus qui détient le rôle PRETEUR, qui est
// secret. Les deux événements correspondants sont donc de classe proprietaire,
// avec DEUX propriétaires : l'émetteur et le destinataire.

import type { Effet } from '../etat/effets.ts';
import { exigerJoueur, trouverJoueur } from '../etat/acces.ts';
import { transferer } from '../etat/mouvements.ts';
import { plafond, unPlus } from '../monnaie/index.ts';
import { recalculerScoresActivite } from '../revelations/score-activite.ts';
import { ecritureDe } from '../machine/flux.ts';
import type { ContexteMoteur, EtatSession, Pret } from '../etat/types.ts';
import {
  auteurDe,
  booleenDe,
  entierDe,
  refus,
  succes,
  texteDe,
  type ResultatCommande,
} from './resultat.ts';

const ROLE_PRETEUR = 'PRETEUR';

function cibleUtilisable(etat: EtatSession, auteur: string, cible: string | null): boolean {
  return cible !== null && cible !== auteur && trouverJoueur(etat, cible) !== undefined;
}

export function transfererPieces(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const cible = texteDe(charge, 'cible_joueur_id');
  if (!cibleUtilisable(etat, auteur, cible)) {
    return refus(etat, 'CIBLE_INVALIDE', 'Cible inconnue, hors session, ou égale à l’émetteur.');
  }
  const montant = entierDe(charge, 'montant');
  if (montant === null || montant < 1) {
    return refus(etat, 'MONTANT_INVALIDE', 'Le montant transféré doit être un entier positif.');
  }
  if (montant > exigerJoueur(etat, auteur).solde_pieces) {
    return refus(etat, 'SOLDE_INSUFFISANT', 'Solde insuffisant pour ce transfert.');
  }

  const destinataire = cible as string;
  const apres = transferer(
    etat,
    {
      de: auteur,
      vers: destinataire,
      montant,
      motif_debit: 'transfert_emis',
      motif_credit: 'transfert_recu',
      manche_numero: etat.manche_courante,
    },
    ecritureDe(contexte),
  );

  const effets: Effet[] = [
    {
      type: 'transfert_enregistre',
      emetteur_joueur_id: auteur,
      destinataire_joueur_id: destinataire,
      montant,
    },
    { type: 'solde_mis_a_jour', joueur_id: auteur },
    { type: 'solde_mis_a_jour', joueur_id: destinataire },
  ];
  return succes(recalculerScoresActivite(apres), effets);
}

/** Monopole du rôle PRETEUR (RG-29, CA-33). Le refus ne nomme aucun rôle. */
export function proposerPret(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  if (exigerJoueur(etat, auteur).role_secret !== ROLE_PRETEUR) {
    return refus(etat, 'ACTION_NON_AUTORISEE_ROLE', 'Cette commande n’est pas autorisée.');
  }
  const emprunteur = texteDe(charge, 'emprunteur_joueur_id');
  if (!cibleUtilisable(etat, auteur, emprunteur)) {
    return refus(etat, 'CIBLE_INVALIDE', 'Emprunteur inconnu, hors session, ou égal au prêteur.');
  }
  const principal = entierDe(charge, 'principal');
  if (principal === null || principal < 1) {
    return refus(etat, 'MONTANT_INVALIDE', 'Le principal doit être un entier positif.');
  }
  if (principal > exigerJoueur(etat, auteur).solde_pieces) {
    return refus(etat, 'SOLDE_INSUFFISANT', 'Solde insuffisant pour prêter ce principal.');
  }

  const pret: Pret = {
    id: contexte.identifiant(),
    preteur_joueur_id: auteur,
    emprunteur_joueur_id: emprunteur as string,
    principal,
    du_total: plafond(principal, unPlus(etat.config.taux_interet_pret)),
    rembourse: 0,
    manche_emission: etat.manche_courante,
    statut: 'PROPOSE',
    cree_at: contexte.horloge.maintenant(),
    repondu_at: null,
  };

  return succes({ ...etat, prets: [...etat.prets, pret] }, [{ type: 'pret_propose', pret }]);
}

function refusReponsePret(
  etat: EtatSession,
  auteur: string,
  pret: Pret | undefined,
  accepte: boolean | null,
): ResultatCommande | null {
  if (pret === undefined) return refus(etat, 'CIBLE_INVALIDE', 'Prêt inconnu.');
  if (pret.emprunteur_joueur_id !== auteur) {
    return refus(
      etat,
      'USURPATION_IDENTITE',
      'Ce prêt n’est pas adressé à l’auteur de la commande.',
    );
  }
  if (pret.statut !== 'PROPOSE') {
    return refus(etat, 'DEJA_SOUMIS', 'Ce prêt a déjà reçu une réponse.');
  }
  if (accepte === null) return refus(etat, 'MESSAGE_MALFORME', 'Réponse au prêt absente.');
  if (accepte && pret.principal > exigerJoueur(etat, pret.preteur_joueur_id).solde_pieces) {
    return refus(etat, 'SOLDE_INSUFFISANT', 'Le prêteur n’a plus le principal disponible.');
  }
  return null;
}

/**
 * RUP-02 / RG-80 : une réponse à un prêt notifie TOUJOURS les soldes des deux
 * parties, que le prêt soit accepté ou refusé.
 *
 * Mesure qui l'impose : à graine identique, deux parties ne différant que par la
 * RÉPONSE de l'emprunteur produisaient 53 trames contre 55 pour chacun des six
 * joueurs. Un prêt accepté déplace des pièces et émettait deux notifications de
 * solde ; un prêt refusé n'en émettait aucune. Le simple DÉNOMBREMENT des
 * trames livrait donc la réponse — qui est un secret au même titre que
 * l'existence du prêt, puisqu'elle désigne indirectement le PRETEUR.
 *
 * Les deux trames partent à TOUS les joueurs, charge neutre pour les N−2 qui ne
 * sont pas parties au prêt : personne n'apprend DE QUI il s'agit, et le
 * dénombrement cesse d'apprendre QUOI.
 */
function soldesDesParties(pret: Pret): readonly Effet[] {
  return [
    { type: 'solde_mis_a_jour', joueur_id: pret.preteur_joueur_id },
    { type: 'solde_mis_a_jour', joueur_id: pret.emprunteur_joueur_id },
  ];
}

function refuserPret(etat: EtatSession, pret: Pret, repondu: number): ResultatCommande {
  const refuse: Pret = { ...pret, statut: 'REFUSE', repondu_at: repondu };
  return succes({ ...etat, prets: etat.prets.map((p) => (p.id === pret.id ? refuse : p)) }, [
    { type: 'pret_resolu', pret: refuse, accepte: false },
    ...soldesDesParties(refuse),
  ]);
}

export function repondrePret(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const pretId = texteDe(charge, 'pret_id');
  const pret = etat.prets.find((candidat) => candidat.id === pretId);
  const accepte = booleenDe(charge, 'accepte');
  const refuse = refusReponsePret(etat, auteur, pret, accepte);
  if (refuse !== null) return refuse;

  const retenu = pret as Pret;
  const repondu = contexte.horloge.maintenant();
  if (accepte !== true) return refuserPret(etat, retenu, repondu);
  return accepterPret(etat, retenu, repondu, contexte);
}

function accepterPret(
  etat: EtatSession,
  pret: Pret,
  repondu: number,
  contexte: ContexteMoteur,
): ResultatCommande {
  const actif: Pret = {
    ...pret,
    statut: 'ACTIF',
    repondu_at: repondu,
    manche_emission: etat.manche_courante,
    du_total: plafond(pret.principal, unPlus(etat.config.taux_interet_pret)),
  };
  const apres = transferer(
    etat,
    {
      de: pret.preteur_joueur_id,
      vers: pret.emprunteur_joueur_id,
      montant: pret.principal,
      motif_debit: 'pret_emis',
      motif_credit: 'pret_recu',
      manche_numero: etat.manche_courante,
    },
    ecritureDe(contexte),
  );

  const effets: Effet[] = [
    { type: 'pret_resolu', pret: actif, accepte: true },
    ...soldesDesParties(actif),
  ];
  return succes(
    { ...apres, prets: apres.prets.map((p) => (p.id === pret.id ? actif : p)) },
    effets,
  );
}
