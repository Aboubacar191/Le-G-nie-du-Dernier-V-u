// =============================================================================
// SCÉNARIOS DE MESURE — porte verifier:uniformite
// =============================================================================
// Le harnais n'est PAS réécrit : ces scénarios pilotent qa/sondes/banc.ts, écrit
// par l'ingénieur QA, qui joue le moteur par ses seules portes publiques et
// enregistre toutes les trames réellement projetées, destinataire par
// destinataire, exactement comme la boucle de session du serveur. Aucun serveur
// n'est démarré, aucun port n'est ouvert : la porte s'exécute sur une machine
// partagée sans rien déranger.
//
// Les paires différentielles suivent la méthode des sondes du QA : deux parties
// à graine IDENTIQUE et suite de commandes identique, ne différant que par UN
// acte secret. C'est le seul dispositif du dépôt dont les deux opérandes soient
// indépendants (ADR-TL-24), donc le seul qui ne soit pas tautologique.
// =============================================================================

import { Banc } from '../../qa/sondes/banc.ts';

const MONTANT = 3;
const MONTANT_MENTEUR = 1;
const TRANSFERT = 2;
const PRINCIPAL_PRET = 3;

type Couples = readonly (readonly [number, number])[];

const couples = (nb: number, paiements: Readonly<Record<number, number>> = {}): Couples =>
  Array.from({ length: nb }, (_, index): readonly [number, number] => [
    MONTANT,
    paiements[index] ?? MONTANT,
  ]);

function jusquaExecution(banc: Banc): Banc {
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  banc.allerA('EXECUTION');
  return banc;
}

/**
 * U1 — partie complète à effectif donné, avec de l'activité SECRÈTE de
 * plusieurs natures : un transfert, un paiement différent du voisin, une
 * enquête. Si une seule de ces trois choses change la forme du trafic, U1 le
 * voit sans rien savoir du contenu.
 */
export function partieComplete(joueurs: number): Banc {
  const banc = new Banc({ joueurs, graine: 'porte-uniformite-U1' });
  banc.demarrer();
  banc.allerA('NEGOCIATION');
  banc.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: TRANSFERT });
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(joueurs, { 4: MONTANT_MENTEUR }));
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  banc.exiger('J3', 'lancer_enquete', { cible_joueur_id: 'J1' });
  banc.allerA('EXECUTION');
  banc.expirer();
  // Deuxième manche : une partie d'une seule manche ne verrait pas les canaux
  // qui ne s'ouvrent qu'à la clôture.
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(joueurs));
  return jusquaExecution(banc);
}

export interface Paire {
  readonly id: string;
  readonly etiquette: string;
  readonly a: Banc;
  readonly b: Banc;
  readonly acteur: string;
}

/** Socle commun des paires : même graine, mêmes rôles, même clause. */
function socle(graine: string, roles: Readonly<Record<string, string>> = {}): Banc {
  const banc = new Banc({ joueurs: 6, graine });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'MARCHAND_EPICES');
  for (const [joueur, role] of Object.entries(roles)) {
    banc.imposerRole(joueur, role as Parameters<Banc['imposerRole']>[1]);
  }
  banc.imposerClause('CONSOLATION');
  return banc;
}

function paiement(montantDeJ5: number): Banc {
  const banc = socle('diff-paiement');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6, { 5: montantDeJ5 }));
  return jusquaExecution(banc);
}

function enquete(avec: boolean): Banc {
  const banc = socle('diff-enquete');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  if (avec) banc.exiger('J2', 'lancer_enquete', { cible_joueur_id: 'J0' });
  banc.allerA('EXECUTION');
  return banc;
}

function transfert(avec: boolean): Banc {
  const banc = socle('diff-transfert');
  banc.allerA('NEGOCIATION');
  if (avec) banc.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: TRANSFERT });
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  return jusquaExecution(banc);
}

function roles(permute: boolean): Banc {
  const banc = socle('diff-roles', {
    J4: permute ? 'PRETEUR' : 'INSPECTEUR_TRESOR',
    J5: permute ? 'INSPECTEUR_TRESOR' : 'PRETEUR',
  });
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  return jusquaExecution(banc);
}

function porteurClause(porteur: string): Banc {
  const banc = socle('diff-porteur');
  banc.etat = {
    ...banc.etat,
    manches: banc.etat.manches.map((manche) =>
      manche.numero === 1 ? { ...manche, porteur_clause_joueur_id: porteur } : manche,
    ),
  };
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  return jusquaExecution(banc);
}

function pretPropose(avec: boolean): Banc {
  const banc = socle('diff-pret', { J1: 'PRETEUR' });
  banc.allerA('NEGOCIATION');
  if (avec) {
    banc.exiger('J1', 'proposer_pret', {
      emprunteur_joueur_id: 'J2',
      principal: PRINCIPAL_PRET,
    });
  }
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  return jusquaExecution(banc);
}

function pretAccepte(accepte: boolean): Banc {
  const banc = socle('diff-pret-reponse', { J1: 'PRETEUR' });
  banc.allerA('NEGOCIATION');
  const propose = banc.exiger('J1', 'proposer_pret', {
    emprunteur_joueur_id: 'J2',
    principal: PRINCIPAL_PRET,
  });
  const effets = propose.ok ? propose.effets : [];
  const effet = effets.find((candidat) => candidat.type === 'pret_propose') as
    | { readonly pret?: { readonly id?: string } }
    | undefined;
  const pretId = effet?.pret?.id;
  if (pretId !== undefined) banc.exiger('J2', 'repondre_pret', { pret_id: pretId, accepte });
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer(couples(6));
  return jusquaExecution(banc);
}

/**
 * La liste fermée des actes secrets de U2 (ARCHI seuils_qualite /
 * API x-temps-reel.uniformite_de_forme.verification.U2_invariance_differentielle).
 * La signature du Dernier Vœu N'EST PAS couverte ici : elle exige le mode
 * avancé et un parcours DV complet. Lacune DÉCLARÉE, pas silencieuse — voir
 * l'en-tête de outils/verifier-uniformite.ts.
 */
export function pairesDifferentielles(): readonly Paire[] {
  return [
    { id: 'U2/1', etiquette: 'U2/1 paiement secret de J5 (3 contre 1, déclaration inchangée)', a: paiement(MONTANT), b: paiement(MONTANT_MENTEUR), acteur: 'J5' },
    { id: 'U2/2', etiquette: 'U2/2 enquête secrète de J2 sur J0 (lancée contre non lancée)', a: enquete(false), b: enquete(true), acteur: 'J2' },
    { id: 'U2/3', etiquette: 'U2/3 transfert de J1 vers J2 (effectué contre non effectué)', a: transfert(false), b: transfert(true), acteur: 'J1' },
    { id: 'U2/4', etiquette: 'U2/4 permutation des rôles secrets de J4 et J5', a: roles(false), b: roles(true), acteur: 'J4' },
    { id: 'U2/5', etiquette: 'U2/5 identité du porteur de la clause (J3 contre J4)', a: porteurClause('J3'), b: porteurClause('J4'), acteur: 'J3' },
    { id: 'U2/6', etiquette: 'U2/6 prêt proposé par J1 à J2 (proposé contre non proposé)', a: pretPropose(false), b: pretPropose(true), acteur: 'J1' },
    { id: 'U2/7', etiquette: 'U2/7 réponse de J2 au prêt (accepté contre refusé)', a: pretAccepte(false), b: pretAccepte(true), acteur: 'J2' },
  ];
}
