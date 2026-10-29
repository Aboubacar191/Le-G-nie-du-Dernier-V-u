// SONDE — AXE 1 : prêts et codes d'erreur comme canaux de fuite.
//
// Deux mesures :
//   (A) EvtPretPreleve porte montant_preleve et reliquat_du aux DEUX parties.
//       Quand le prélèvement est plafonné (étape 15), montant_preleve est
//       exactement le solde de l'emprunteur à cet instant : le prêteur apprend
//       le solde d'un autre joueur, donnée classée « serveur, proprietaire ».
//   (B) repondre_pret refuse avec SOLDE_INSUFFISANT quand le PRÊTEUR n'a plus
//       le principal : le code d'erreur renseigne l'emprunteur sur le solde
//       caché d'un tiers. Et le couple CIBLE_INVALIDE / USURPATION_IDENTITE
//       forme un oracle d'existence sur les identifiants de prêt.

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function table(graine: string): Banc {
  const banc = new Banc({ joueurs: 6, graine });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  banc.imposerRole('J0', 'PRETEUR');
  // TRESOR_DES_HONNETES n'agit qu'en cas de succès : inerte sur un vœu échoué.
  banc.imposerClause('TRESOR_DES_HONNETES');
  return banc;
}

function echouerLaManche(banc: Banc): void {
  banc.allerA('DECLARATION_PAIEMENT');
  for (const joueur of banc.joueurs) banc.exiger(joueur, 'declarer_contribution', { montant: 0 });
  for (const joueur of banc.joueurs) banc.exiger(joueur, 'payer_secret', { montant: 0 });
}

// --- (A) Prélèvement plafonné -----------------------------------------------

titre('(A) Prélèvement de prêt plafonné : le prêteur apprend le solde de l’emprunteur');
const banc = table('pret-plafonne');
banc.allerA('NEGOCIATION');
banc.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 6 });
const pretId = banc.etat.prets[0]?.id ?? '';
banc.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: true });
mesure('du_total du prêt', banc.etat.prets[0]?.du_total);
mesure('solde J1 après encaissement', banc.solde('J1'));
echouerLaManche(banc);
banc.allerA('EXECUTION');
banc.expirer();
banc.allerA('NEGOCIATION');
// L'emprunteur se vide : son solde descend sous le dû.
banc.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 15 });
const soldeAvantPrelevement = banc.solde('J1');
mesure('solde J1 juste avant le prélèvement (secret)', soldeAvantPrelevement);
echouerLaManche(banc);
banc.allerA('EXECUTION');

const trame = banc.pour('J0', 'pret_preleve')[0];
mesure('trame pret_preleve reçue par le PRÊTEUR J0', trame?.charge ?? null);
const montantPreleve = Number((trame?.charge as { montant_preleve?: number } | undefined)?.montant_preleve);
const reliquat = Number((trame?.charge as { reliquat_du?: number } | undefined)?.reliquat_du);
mesure('solde de J1 déduit par J0 (= montant_preleve car plafonné)', montantPreleve);
mesure('reliquat dû publié aux deux parties', reliquat);
verdict(
  'le prêteur ne peut pas déduire le solde exact de l’emprunteur',
  !(reliquat > 0 && montantPreleve === soldeAvantPrelevement),
  `reliquat ${String(reliquat)} > 0 et montant_preleve ${String(montantPreleve)} = solde réel ${String(soldeAvantPrelevement)}`,
);
mesure('solde J1 après prélèvement', banc.solde('J1'));

// --- (B) Codes d'erreur différenciés ----------------------------------------

titre('(B) repondre_pret : le refus renseigne sur le solde du prêteur');
const banc2 = table('erreur-pret');
banc2.allerA('NEGOCIATION');
banc2.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 6 });
const pret2 = banc2.etat.prets[0]?.id ?? '';
banc2.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J3', montant: 10 });
mesure('solde du prêteur J0 après son transfert (secret pour J1)', banc2.solde('J0'));
const refus = banc2.cmd('J1', 'repondre_pret', { pret_id: pret2, accepte: true });
const erreur = refus.ok ? null : (refus.erreur as { code: string; message: string });
mesure('erreur rendue à l’emprunteur J1', erreur);
verdict(
  'le refus ne renseigne pas J1 sur le solde de J0',
  erreur === null || erreur.code !== 'SOLDE_INSUFFISANT',
  'J1 apprend que solde(J0) < 6, et le message le dit explicitement',
);

titre('(B bis) Oracle d’existence sur un identifiant de prêt');
const inconnu = banc2.cmd('J2', 'repondre_pret', { pret_id: 'identifiant-inexistant', accepte: true });
const autrui = banc2.cmd('J2', 'repondre_pret', { pret_id: pret2, accepte: true });
mesure('prêt inexistant', inconnu.ok ? 'accepte' : (inconnu.erreur as { code: string }).code);
mesure('prêt existant mais adressé à autrui', autrui.ok ? 'accepte' : (autrui.erreur as { code: string }).code);
const codeInconnu = inconnu.ok ? '' : (inconnu.erreur as { code: string }).code;
const codeAutrui = autrui.ok ? '' : (autrui.erreur as { code: string }).code;
verdict(
  'les deux refus sont indiscernables',
  codeInconnu === codeAutrui,
  `${codeInconnu} contre ${codeAutrui} : oracle d’existence (atténué par des identifiants UUIDv4 non devinables)`,
);

titre('(C) Témoins : refus qui ne dépendent que de l’état de l’auteur');
const banc3 = table('refus-temoins');
banc3.allerA('DECLARATION_PAIEMENT');
banc3.exiger('J1', 'declarer_contribution', { montant: 4 });
banc3.exiger('J1', 'payer_secret', { montant: 1 });
const double = banc3.cmd('J1', 'payer_secret', { montant: 1 });
mesure('second paiement', double.ok ? 'accepte' : (double.erreur as { code: string }).code);
const tropGrand = banc3.cmd('J2', 'declarer_contribution', { montant: 99 });
mesure('déclaration supérieure au solde', tropGrand.ok ? 'accepte' : (tropGrand.erreur as { code: string }).code);
banc3.allerA('ENQUETES_ACCUSATIONS');
const enquete1 = banc3.cmd('J2', 'lancer_enquete', { cible_joueur_id: 'J1' });
const enquete2 = banc3.cmd('J2', 'lancer_enquete', { cible_joueur_id: 'J1' });
mesure('enquête répétée sur la même cible', enquete2.ok ? 'accepte' : (enquete2.erreur as { code: string }).code);
mesure('première enquête acceptée', enquete1.ok);
const soi = banc3.cmd('J2', 'lancer_enquete', { cible_joueur_id: 'J2' });
mesure('enquête sur soi-même', soi.ok ? 'accepte' : (soi.erreur as { code: string }).code);
const accuseSoi = banc3.cmd('J2', 'accuser', { accuse_joueur_id: 'J2' });
mesure('accusation de soi-même', accuseSoi.ok ? 'accepte' : (accuseSoi.erreur as { code: string }).code);
verdict('enquête répétée refusée (QUOTA_DEPASSE)', !enquete2.ok);
verdict('enquête et accusation sur soi refusées (CIBLE_INVALIDE)', !soi.ok && !accuseSoi.ok);
verdict(
  'la cible d’une enquête ne reçoit aucune trame',
  banc3.pour('J1', 'resultat_enquete').length === 0 &&
    banc3.pour('J1').filter((t) => t.ordre > (banc3.pour('J2', 'resultat_enquete')[0]?.ordre ?? 0) - 1 && t.type === 'resultat_enquete').length === 0,
);

bilan('fuite-prets-et-erreurs');
