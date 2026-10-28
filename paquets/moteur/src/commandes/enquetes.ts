// Phase ENQUETES_ACCUSATIONS — achat d'information privée, et accusation
// publique.
//
// RG-27 / CA-19 : l'enquête est secrète de bout en bout. Ni la cible ni la
// table n'apprennent qu'elle a eu lieu — c'est ce qui rend le chantage
// possible. Aucun effet n'est émis vers la cible, ni maintenant ni plus tard, et
// le mouvement de pièces de motif cout_enquete est lui aussi privé.
//
// RG-43 / RG-75 : le verdict d'accusation est public IMMÉDIATEMENT, mais sans
// l'ampleur du mensonge ni le montant d'amende : l'ampleur révélerait le
// paiement de l'accusé, et le montant révélerait la clause PRIME_AU_DELATEUR
// avant l'étape 16. La liquidation monétaire est différée à l'EXECUTION.

import type { Verdict } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import {
  declareDe,
  exigerJoueur,
  exigerMancheCourante,
  payeDe,
  trouverJoueur,
} from '../etat/acces.ts';
import { appliquerMouvement } from '../etat/mouvements.ts';
import { ecritureDe } from '../machine/flux.ts';
import { recalculerScoresActivite } from '../revelations/score-activite.ts';
import type {
  Accusation,
  ContexteMoteur,
  Enquete,
  EtatSession,
  Manche,
} from '../etat/types.ts';
import { auteurDe, refus, succes, texteDe, type ResultatCommande } from './resultat.ts';

const ROLE_INSPECTEUR = 'INSPECTEUR_TRESOR';

function avecMancheMaj(etat: EtatSession, manche: Manche): EtatSession {
  return { ...etat, manches: etat.manches.map((m) => (m.numero === manche.numero ? manche : m)) };
}

/** RG-26 : coût réduit pour l'INSPECTEUR_TRESOR, lu dans la configuration. */
export function coutEnqueteDe(etat: EtatSession, joueurId: string): number {
  const inspecteur = exigerJoueur(etat, joueurId).role_secret === ROLE_INSPECTEUR;
  return inspecteur ? etat.config.cout_enquete_inspecteur_tresor : etat.config.cout_enquete;
}

/** Les trois refus possibles d'une enquête, dans l'ordre : cible, quota, solde. */
function refusEnquete(
  etat: EtatSession,
  auteur: string,
  cible: string | null,
): ResultatCommande | null {
  if (cible === null || cible === auteur || trouverJoueur(etat, cible) === undefined) {
    return refus(etat, 'CIBLE_INVALIDE', 'Cible inconnue, hors session, ou égale à l’enquêteur.');
  }
  const dejaFaite = exigerMancheCourante(etat).enquetes.some(
    (enquete) => enquete.enqueteur_joueur_id === auteur && enquete.cible_joueur_id === cible,
  );
  if (dejaFaite) {
    return refus(etat, 'QUOTA_DEPASSE', 'Une enquête a déjà été menée sur cette cible (RG-28).');
  }
  if (coutEnqueteDe(etat, auteur) > exigerJoueur(etat, auteur).solde_pieces) {
    return refus(etat, 'SOLDE_INSUFFISANT', 'Solde insuffisant pour financer cette enquête.');
  }
  return null;
}

/**
 * Le résultat est une COPIE FIGÉE du paiement de la cible à l'instant de
 * l'enquête (ARCHI enquetes.resultat_montant_paye) : l'enquêteur a acheté ce
 * qu'il a vu, et un recalcul ultérieur n'a pas à le réviser.
 */
function nouvelleEnquete(
  etat: EtatSession,
  auteur: string,
  cible: string,
  cout: number,
  contexte: ContexteMoteur,
): Enquete {
  const manche = exigerMancheCourante(etat);
  return {
    id: contexte.identifiant(),
    enqueteur_joueur_id: auteur,
    cible_joueur_id: cible,
    cout_paye: cout,
    resultat_montant_paye: payeDe(manche, cible),
    resultat_montant_declare: declareDe(manche, cible),
    cree_at: contexte.horloge.maintenant(),
  };
}

export function lancerEnquete(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const demande = texteDe(charge, 'cible_joueur_id');
  const refuse = refusEnquete(etat, auteur, demande);
  if (refuse !== null) return refuse;

  const cible = demande as string;
  const manche = exigerMancheCourante(etat);
  const cout = coutEnqueteDe(etat, auteur);
  const enquete = nouvelleEnquete(etat, auteur, cible, cout, contexte);

  const enregistree = avecMancheMaj(etat, {
    ...manche,
    enquetes: [...manche.enquetes, enquete],
  });
  const debitee =
    cout === 0
      ? enregistree
      : appliquerMouvement(
          enregistree,
          {
            joueur_id: auteur,
            delta: -cout,
            motif: 'cout_enquete',
            manche_numero: manche.numero,
          },
          ecritureDe(contexte),
        );

  const effets: Effet[] = [
    {
      type: 'resultat_enquete',
      enqueteur_joueur_id: auteur,
      cible_joueur_id: cible,
      montant_paye: enquete.resultat_montant_paye,
      montant_declare: enquete.resultat_montant_declare,
      cout_paye: cout,
      numero_manche: manche.numero,
    },
    { type: 'solde_mis_a_jour', joueur_id: auteur },
  ];
  return succes(recalculerScoresActivite(debitee), effets);
}

/** Le verdict est calculé par le serveur, JAMAIS fourni par le client. */
function verdictDe(manche: Manche, accuse: string): { verdict: Verdict; ampleur: number } {
  const ampleur = declareDe(manche, accuse) - payeDe(manche, accuse);
  return { verdict: ampleur > 0 ? 'MENTEUR' : 'HONNETE', ampleur };
}

export function accuser(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const accuse = texteDe(charge, 'accuse_joueur_id');
  if (accuse === null || accuse === auteur || trouverJoueur(etat, accuse) === undefined) {
    return refus(etat, 'CIBLE_INVALIDE', 'Accusé inconnu, hors session, ou égal à l’accusateur.');
  }
  const manche = exigerMancheCourante(etat);
  const dejaPortees = manche.accusations.filter(
    (accusation) => accusation.accusateur_joueur_id === auteur,
  ).length;
  if (dejaPortees >= etat.config.accusations_max_par_joueur_par_manche) {
    return refus(etat, 'QUOTA_DEPASSE', 'Quota d’accusations de la manche atteint (RG-19).');
  }

  const { verdict, ampleur } = verdictDe(manche, accuse);
  const accusation: Accusation = {
    id: contexte.identifiant(),
    accusateur_joueur_id: auteur,
    accuse_joueur_id: accuse,
    verdict,
    ampleur_mensonge: ampleur,
    montant_amende_du: 0,
    montant_amende_liquide: 0,
    liquide_at: null,
    cree_at: contexte.horloge.maintenant(),
  };

  const apres = avecMancheMaj(etat, {
    ...manche,
    accusations: [...manche.accusations, accusation],
  });

  const effets: Effet[] = [
    { type: 'accusation_declaree', accusation, numero_manche: manche.numero },
    { type: 'accusation_resolue', accusation_id: accusation.id, verdict },
  ];
  return succes(recalculerScoresActivite(apres), effets);
}
