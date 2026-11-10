// Générateur de parties pour les tests de propriété.
//
// Les états ne sont pas fabriqués à la main : ils sont tirés par fast-check,
// qui produit des scénarios de partie entiers — effectif, graine, déclarations,
// paiements, enquêtes, accusations, transferts, signatures — et les joue à
// travers le MOTEUR RÉEL. Un état inventé à la main ne prouve que ce qu'on y a
// mis ; un état joué porte toutes les conséquences que le moteur en tire.
//
// Chaque commande passe par `cmd` et non par `exiger` : un refus fait partie du
// scénario. Un plan tiré au hasard demandera parfois l'impossible — déclarer
// plus que son solde, enquêter sans pièces — et c'est très bien : la propriété
// de non-fuite doit tenir aussi après un refus.

import fc from 'fast-check';

import { Table } from '../aide/table.ts';

export interface PlanManche {
  readonly montants: readonly number[];
  readonly ratios: readonly number[];
  readonly enquete: number;
  readonly accusation: number;
  readonly transfert: number;
}

export interface PlanPartie {
  readonly joueurs: number;
  readonly graine: string;
  readonly mode_avance: boolean;
  readonly manches: readonly PlanManche[];
  readonly signatures: readonly boolean[];
}

const EFFECTIF_MAXIMUM = 8;

const planManche = fc.record({
  montants: fc.array(fc.integer({ min: 0, max: 6 }), {
    minLength: EFFECTIF_MAXIMUM,
    maxLength: EFFECTIF_MAXIMUM,
  }),
  ratios: fc.array(fc.integer({ min: 0, max: 2 }), {
    minLength: EFFECTIF_MAXIMUM,
    maxLength: EFFECTIF_MAXIMUM,
  }),
  enquete: fc.integer({ min: 0, max: EFFECTIF_MAXIMUM }),
  accusation: fc.integer({ min: 0, max: EFFECTIF_MAXIMUM }),
  transfert: fc.integer({ min: 0, max: EFFECTIF_MAXIMUM }),
});

export const planPartie: fc.Arbitrary<PlanPartie> = fc.record({
  joueurs: fc.integer({ min: 5, max: EFFECTIF_MAXIMUM }),
  graine: fc.string({ minLength: 1, maxLength: 12 }),
  mode_avance: fc.boolean(),
  manches: fc.array(planManche, { minLength: 1, maxLength: 5 }),
  signatures: fc.array(fc.boolean(), {
    minLength: EFFECTIF_MAXIMUM,
    maxLength: EFFECTIF_MAXIMUM,
  }),
});

function jouerNegociation(table: Table, manche: PlanManche): void {
  table.allerA('NEGOCIATION');
  const emetteur = table.joueurs[manche.transfert % table.joueurs.length];
  const receveur = table.joueurs[(manche.transfert + 1) % table.joueurs.length];
  if (emetteur === undefined || receveur === undefined || emetteur === receveur) return;
  table.cmd(emetteur, 'transferer_pieces', { cible_joueur_id: receveur, montant: 1 });
}

function paiementDemande(demande: number, ratio: number): number {
  if (ratio === 0) return 0;
  if (ratio === 1) return Math.floor(demande / 2);
  return demande;
}

function jouerDeclarations(table: Table, manche: PlanManche): void {
  table.allerA('DECLARATION_PAIEMENT');
  table.joueurs.forEach((joueur, rang) => {
    const demande = Math.min(manche.montants[rang] ?? 0, table.solde(joueur));
    table.cmd(joueur, 'declarer_contribution', { montant: demande });
    table.cmd(joueur, 'payer_secret', {
      montant: paiementDemande(demande, manche.ratios[rang] ?? 0),
    });
  });
}

function jouerEnquetesEtAccusations(table: Table, manche: PlanManche): void {
  table.allerA('ENQUETES_ACCUSATIONS');
  const effectif = table.joueurs.length;
  const enqueteur = table.joueurs[manche.enquete % effectif];
  const cible = table.joueurs[(manche.enquete + 1) % effectif];
  if (enqueteur !== undefined && cible !== undefined && enqueteur !== cible) {
    table.cmd(enqueteur, 'lancer_enquete', { cible_joueur_id: cible });
  }
  const accusateur = table.joueurs[manche.accusation % effectif];
  const accuse = table.joueurs[(manche.accusation + 2) % effectif];
  if (accusateur !== undefined && accuse !== undefined && accusateur !== accuse) {
    table.cmd(accusateur, 'accuser', { accuse_joueur_id: accuse });
  }
}

const LIMITE_EXPIRATIONS = 60;

function terminerLesManchesRestantes(table: Table): void {
  let pas = 0;
  while (table.etat.etat_partie === 'MANCHE_EN_COURS' && pas < LIMITE_EXPIRATIONS) {
    table.expirer();
    pas += 1;
  }
}

function jouerDernierVoeu(table: Table, plan: PlanPartie): void {
  if (table.etat.phase !== 'DV_PROPOSITION') return;
  table.allerA('DV_SIGNATURE');
  table.joueurs.forEach((joueur, rang) => {
    table.cmd(joueur, 'signer_dernier_voeu', { a_signe: plan.signatures[rang] === true });
  });
  table.expirer();
}

/**
 * Écran 1b : au moins un joueur bascule son statut prêt pendant SALLE_ATTENTE,
 * avant que l'hôte ne démarre. Couvre joueur_pret_change sans peser sur le
 * reste du plan — purement informatif, aucune incidence sur demarrer_partie.
 */
function jouerSalleAttente(table: Table): void {
  const premier = table.joueurs[0];
  if (premier !== undefined) table.cmd(premier, 'signaler_pret', { pret: true });
}

/** Joue le plan à travers le moteur réel et rend la table, trames comprises. */
export function jouer(plan: PlanPartie): Table {
  const table = new Table({
    joueurs: plan.joueurs,
    graine: plan.graine,
    mode_avance: plan.mode_avance,
  });
  jouerSalleAttente(table);
  table.demarrer();

  for (const manche of plan.manches) {
    if (table.etat.etat_partie !== 'MANCHE_EN_COURS') break;
    jouerNegociation(table, manche);
    jouerDeclarations(table, manche);
    jouerEnquetesEtAccusations(table, manche);
    table.allerA('EXECUTION');
    table.expirer();
  }

  terminerLesManchesRestantes(table);
  jouerDernierVoeu(table, plan);
  return table;
}
