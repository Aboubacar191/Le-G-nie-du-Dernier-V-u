// Phase DECLARATION_PAIEMENT — la double vérité, cœur du jeu.
//
// RG-31 : les deux actes sont simultanés pour toute la table. La déclaration est
// PUBLIÉE dès sa soumission : c'est une annonce. Le paiement ne l'est JAMAIS :
// EvtPaiementEnregistre ne porte aucun montant, même vers son propre auteur —
// il vient de le saisir, et un champ de montant en moins est une occasion de
// fuite en moins.
//
// RG-70 : une seconde déclaration REMPLACE la première tant que le paiement
// n'est pas soumis, puis est refusée. Un second paiement est toujours refusé.

import type { Effet } from '../etat/effets.ts';
import { contributionDe, exigerJoueur, exigerMancheCourante } from '../etat/acces.ts';
import { appliquerMouvement } from '../etat/mouvements.ts';
import { ecritureDe } from '../machine/flux.ts';
import type { Contribution, ContexteMoteur, EtatSession, Manche } from '../etat/types.ts';
import { auteurDe, entierDe, refus, succes, type ResultatCommande } from './resultat.ts';

function avecContribution(
  etat: EtatSession,
  manche: Manche,
  contribution: Contribution,
): EtatSession {
  const autres = manche.contributions.filter((c) => c.joueur_id !== contribution.joueur_id);
  const majour: Manche = { ...manche, contributions: [...autres, contribution] };
  return { ...etat, manches: etat.manches.map((m) => (m.numero === manche.numero ? majour : m)) };
}

/** CA-07 : déclarer plus que son solde est refusé, et aucun montant n'est publié. */
export function declarerContribution(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const manche = exigerMancheCourante(etat);
  const existante = contributionDe(manche, auteur);
  if (existante?.montant_paye !== undefined && existante.montant_paye !== null) {
    return refus(etat, 'DEJA_SOUMIS', 'Le paiement est déjà soumis : la déclaration est figée.');
  }
  const montant = entierDe(charge, 'montant');
  if (montant === null || montant < 0) {
    return refus(etat, 'MONTANT_INVALIDE', 'Le montant déclaré doit être un entier positif ou nul.');
  }
  if (montant > exigerJoueur(etat, auteur).solde_pieces) {
    return refus(etat, 'MONTANT_INVALIDE', 'La déclaration ne peut pas dépasser le solde (RG-08).');
  }

  const contribution: Contribution = {
    joueur_id: auteur,
    montant_declare: montant,
    montant_paye: null,
    declare_at: contexte.horloge.maintenant(),
    paye_at: null,
  };
  const effet: Effet = {
    type: 'declaration_publiee',
    joueur_id: auteur,
    montant_declare: montant,
  };
  // nb_declarations et nb_joueurs sont calculés par la projection depuis l'état :
  // un compteur recopié dans l'effet serait une seconde vérité.
  return succes(avecContribution(etat, manche, contribution), [effet]);
}

/** Tous les joueurs ont-ils déclaré ET payé ? (CA-49 : fin de phase anticipée) */
export function tousOntDeclareEtPaye(etat: EtatSession): boolean {
  const manche = exigerMancheCourante(etat);
  return etat.joueurs.every((joueur) => {
    const contribution = contributionDe(manche, joueur.id);
    return (
      contribution !== undefined &&
      contribution.montant_paye !== null
    );
  });
}

/** Débite le payeur, sauf si le paiement est nul (aucun mouvement de 0). */
function avecDebit(
  etat: EtatSession,
  manche: Manche,
  auteur: string,
  montant: number,
  contexte: ContexteMoteur,
): EtatSession {
  if (montant === 0) return etat;
  return appliquerMouvement(
    etat,
    { joueur_id: auteur, delta: -montant, motif: 'paiement_voeu', manche_numero: manche.numero },
    ecritureDe(contexte),
  );
}

/** CA-09 : payer plus que déclaré est refusé. CA-10 : le montant ne sort jamais. */
export function payerSecret(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  const manche = exigerMancheCourante(etat);
  const existante = contributionDe(manche, auteur);
  if (existante === undefined) {
    return refus(etat, 'DECLARATION_REQUISE', 'Il faut déclarer avant de payer (RG-10).');
  }
  if (existante.montant_paye !== null) {
    return refus(etat, 'DEJA_SOUMIS', 'Le paiement est déjà soumis.');
  }
  const montant = entierDe(charge, 'montant');
  if (montant === null || montant < 0 || montant > existante.montant_declare) {
    return refus(
      etat,
      'MONTANT_INVALIDE',
      'Le paiement doit être un entier entre 0 et le montant déclaré (RG-09).',
    );
  }
  if (montant > exigerJoueur(etat, auteur).solde_pieces) {
    return refus(etat, 'SOLDE_INSUFFISANT', 'Solde insuffisant pour ce paiement.');
  }

  const paye: Contribution = {
    ...existante,
    montant_paye: montant,
    paye_at: contexte.horloge.maintenant(),
  };
  const enregistre = avecContribution(etat, manche, paye);
  const apres = avecDebit(enregistre, manche, auteur, montant, contexte);

  const effets: Effet[] = [
    { type: 'paiement_enregistre', joueur_id: auteur, numero_manche: manche.numero },
    { type: 'joueur_offrande_scellee', joueur_id: auteur },
    { type: 'solde_mis_a_jour', joueur_id: auteur },
  ];
  return succes(apres, effets);
}
