// ╔════════════════════════════════════════════════════════════════════════╗
// ║  PREUVE MÉCANIQUE DE RG-01 — les 32 événements, un par un.             ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Le fichier voisin, proprietes.test.ts, vérifie (P-a) et (P-b) sur des parties
// GÉNÉRÉES. Celui-ci les vérifie de façon EXHAUSTIVE : les 32 types
// d'événement du contrat, construits sur un état réel, projetés vers CHAQUE
// destinataire possible — y compris un étranger à la session.
//
// Les deux sont nécessaires. Le tirage aléatoire trouve des états auxquels
// personne n'avait pensé ; l'exhaustivité garantit qu'aucun des 32 types ne
// passe au travers parce qu'un scénario ne l'a pas produit.

import test from 'node:test';
import assert from 'node:assert/strict';

import { TYPES_EVENEMENT } from '@gdv/partage';
import { projeterEvenement, type Effet, type EtatSession } from '@gdv/moteur';

import { jouer, type PlanPartie } from './scenario-genere.ts';
import { verifierAppartenance, verifierCloture } from './verificateurs.ts';

/**
 * Les 32 effets du protocole, construits sur un état réel. Certains sont
 * produits par le TRANSPORT et non par le moteur — accuse_reception, erreur,
 * etat_complet_prive, les trois événements de présence — et n'apparaissent donc
 * pas dans les effets d'une partie jouée. Ils sont néanmoins projetés par la
 * même fonction, et doivent donc satisfaire les mêmes propriétés.
 */
type MancheEtat = EtatSession['manches'][number];

/** Effets qui ne dépendent ni d'une manche ni d'un prêt. */
function effetsDeBase(etat: EtatSession): readonly Effet[] {
  const premier = etat.joueurs[0]?.id ?? 'J0';
  const second = etat.joueurs[1]?.id ?? premier;
  return [
    { type: 'accuse_reception', auteur_joueur_id: premier, id_correlation: 'c', type_commande: 'x' },
    {
      type: 'erreur',
      auteur_joueur_id: premier,
      code: 'ACTION_HORS_PHASE',
      message: 'refus',
      id_correlation: 'c',
    },
    { type: 'etat_complet_prive', destinataire_joueur_id: premier },
    { type: 'etat_partie_change' },
    { type: 'joueur_rejoint', joueur_id: premier },
    { type: 'joueur_quitte', joueur_id: premier },
    { type: 'joueur_reconnecte', joueur_id: premier },
    { type: 'joueur_pret_change', joueur_id: premier, pret: true },
    { type: 'joueur_offrande_scellee', joueur_id: premier },
    { type: 'partie_demarree' },
    { type: 'attribution_privee', joueur_id: premier },
    { type: 'phase_changee' },
    { type: 'declaration_publiee', joueur_id: premier, montant_declare: 1 },
    { type: 'paiement_enregistre', joueur_id: premier, numero_manche: 1 },
    {
      type: 'transfert_enregistre',
      emetteur_joueur_id: premier,
      destinataire_joueur_id: second,
      montant: 1,
    },
    { type: 'solde_mis_a_jour', joueur_id: premier },
    { type: 'dernier_voeu_propose', joueur_id: premier },
    {
      type: 'dernier_voeu_resolu',
      nb_signataires: 1,
      consequence: 'SIGNATAIRE_UNIQUE_RECOMPENSE',
      genie_libere: true,
    },
    { type: 'scores_finaux' },
    { type: 'partie_abandonnee', motif_abandon: 'ABANDON_HOTE' },
    { type: 'groupe_mis_a_jour' },
  ];
}

/** Effets liés à une manche. Construits sur ses données RÉELLES. */
function effetsDeManche(manche: MancheEtat): readonly Effet[] {
  const effets: Effet[] = [
    { type: 'voeu_annonce', numero_manche: manche.numero },
    {
      type: 'clause_recue',
      numero_manche: manche.numero,
      clause: manche.clause_cle,
      porteur_joueur_id: manche.porteur_clause_joueur_id,
    },
    {
      type: 'revelation_ecart_total',
      numero_manche: manche.numero,
      total_declare: manche.total_declare ?? 0,
      total_paye: manche.total_paye ?? 0,
    },
    { type: 'execution_resultat', numero_manche: manche.numero },
  ];
  const revelation = manche.revelations[0];
  if (revelation !== undefined) {
    effets.push({ type: 'revelation', numero_manche: manche.numero, revelation });
  }
  // L'effet d'enquête est construit depuis une enquête RÉELLE : une valeur
  // inventée n'appartiendrait à personne, et le test échouerait sur sa propre
  // fixture plutôt que sur la projection.
  const enquete = manche.enquetes[0];
  if (enquete !== undefined) {
    effets.push({
      type: 'resultat_enquete',
      enqueteur_joueur_id: enquete.enqueteur_joueur_id,
      cible_joueur_id: enquete.cible_joueur_id,
      montant_paye: enquete.resultat_montant_paye,
      montant_declare: enquete.resultat_montant_declare,
      cout_paye: enquete.cout_paye,
      numero_manche: manche.numero,
    });
  }
  const accusation = manche.accusations[0];
  if (accusation !== undefined) {
    effets.push(
      { type: 'accusation_declaree', accusation, numero_manche: manche.numero },
      { type: 'accusation_resolue', accusation_id: accusation.id, verdict: accusation.verdict },
    );
  }
  return effets;
}

function effetsDePret(pret: EtatSession['prets'][number]): readonly Effet[] {
  return [
    { type: 'pret_propose', pret },
    { type: 'pret_resolu', pret, accepte: true },
    { type: 'pret_preleve', pret, montant_preleve: 1, reliquat_du: 0 },
  ];
}

/**
 * Les 32 effets du protocole, construits sur un état réel. Certains sont
 * produits par le TRANSPORT et non par le moteur — accuse_reception, erreur,
 * etat_complet_prive, les trois événements de présence — et n'apparaissent donc
 * pas dans les effets d'une partie jouée. Ils sont néanmoins projetés par la
 * même fonction, et doivent donc satisfaire les mêmes propriétés.
 */
function tousLesEffets(etat: EtatSession): readonly Effet[] {
  // On choisit la manche la plus RICHE : celle qui porte des enquêtes et des
  // accusations. Prendre la dernière donnerait une manche traversée sans action,
  // et six types d'événement resteraient non couverts.
  const manche =
    etat.manches.find(
      (candidate) => candidate.enquetes.length > 0 && candidate.accusations.length > 0,
    ) ?? etat.manches[etat.manches.length - 1];
  const pret = etat.prets[0];
  return [
    ...effetsDeBase(etat),
    ...(manche === undefined ? [] : effetsDeManche(manche)),
    ...(pret === undefined ? [] : effetsDePret(pret)),
  ];
}

test('(P-a) et (P-b) tiennent sur les 32 événements du contrat, pour tout destinataire', () => {
  // Une partie complète en mode avancé, avec prêt, enquête, accusation et
  // révélation : l'état porte de quoi construire les 32 effets.
  const plan: PlanPartie = {
    joueurs: 6,
    graine: 'exhaustif',
    mode_avance: true,
    manches: [
      {
        montants: [4, 4, 4, 4, 4, 6, 0, 0],
        ratios: [2, 2, 2, 1, 0, 0, 0, 0],
        enquete: 0,
        accusation: 1,
        transfert: 2,
      },
    ],
    signatures: [true, false, false, false, false, false, false, false],
  };
  const table = jouer(plan);
  // Un prêt réel, pour que les trois événements de prêt soient construisibles
  // sur des valeurs qui appartiennent effectivement à leurs deux parties.
  table.etat = {
    ...table.etat,
    prets: [
      {
        id: 'pret-test',
        preteur_joueur_id: 'J0',
        emprunteur_joueur_id: 'J1',
        principal: 4,
        du_total: 6,
        rembourse: 0,
        manche_emission: 1,
        statut: 'ACTIF',
        cree_at: table.instant,
        repondu_at: table.instant,
      },
    ],
  };

  const observes = new Set<string>();
  for (const effet of tousLesEffets(table.etat)) {
    observes.add(effet.type);
    for (const joueur of [...table.joueurs, 'ETRANGER']) {
      const charge = projeterEvenement(table.etat, effet, joueur);
      if (charge === null) continue;
      assert.notEqual(joueur, 'ETRANGER', 'un étranger à la session ne reçoit RIEN');
      const cloture = verifierCloture(effet.type, charge);
      assert.equal(cloture, null, cloture ?? '');
      const appartenance = verifierAppartenance(table.etat, effet.type, joueur, charge);
      assert.equal(appartenance, null, appartenance ?? '');
    }
  }

  const manquants = TYPES_EVENEMENT.filter((type) => !observes.has(type));
  assert.deepEqual(manquants, [], `types d’événement non couverts : ${manquants.join(', ')}`);
});
