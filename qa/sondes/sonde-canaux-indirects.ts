// SONDE — AXE 1 : canaux indirects. Nombre de trames, taille, ordre, présence.
//
// Deux mesures distinctes :
//
// (I) SONDE DIFFÉRENTIELLE. On rejoue DEUX fois le même scénario, strictement
//     identique sauf le paiement SECRET de J5 (sa déclaration, elle, est
//     inchangée, donc toute l'information publique de la phase de déclaration
//     est la même). On diffe ensuite les flux reçus par un tiers. Toute
//     différence est une dépendance du flux d'un tiers au secret de J5 : c'est
//     la mesure de l'information qui fuit, pas de l'intention du code.
//
// (II) PROFIL DE TRAFIC. Nombre de trames et octets reçus par joueur et par
//      phase. Un observateur du réseau — DETTE-03, Wi-Fi partagé, et le
//      chiffrement n'y change rien puisqu'il préserve les longueurs — lit ce
//      profil sans lire le contenu.

import { Banc, bilan, mesure, titre, verdict, type Trame } from './banc.ts';

function scenario(paiementDeJ5: number): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'canaux-indirects' });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  banc.imposerRole('J2', 'INSPECTEUR_TRESOR');
  banc.imposerClause('CONSOLATION');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, paiementDeJ5],
  ]);
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  banc.allerA('EXECUTION');
  return banc;
}

function fluxDe(banc: Banc, joueur: string): readonly string[] {
  return banc.pour(joueur).map((trame) => `${trame.type} ${JSON.stringify(trame.charge)}`);
}

titre('(I) Sonde différentielle : seul le paiement secret de J5 change (4 contre 1)');
const honnete = scenario(4);
const menteur = scenario(1);
mesure('déclarations publiques, identiques dans les deux cas', honnete.manche(1).contributions.map((c) => c.montant_declare));
mesure('paiement de J5, cas A', honnete.manche(1).contributions.find((c) => c.joueur_id === 'J5')?.montant_paye);
mesure('paiement de J5, cas B', menteur.manche(1).contributions.find((c) => c.joueur_id === 'J5')?.montant_paye);

const TIERS = 'J1';
const fluxA = fluxDe(honnete, TIERS);
const fluxB = fluxDe(menteur, TIERS);
mesure('nombre de trames reçues par le tiers J1, cas A', fluxA.length);
mesure('nombre de trames reçues par le tiers J1, cas B', fluxB.length);

const divergences: string[] = [];
const longueur = Math.max(fluxA.length, fluxB.length);
for (let index = 0; index < longueur; index += 1) {
  if (fluxA[index] !== fluxB[index]) {
    divergences.push(`#${String(index)}\n      A: ${String(fluxA[index])}\n      B: ${String(fluxB[index])}`);
  }
}
console.log(`  MESURE  trames divergentes vues par un TIERS : ${String(divergences.length)}`);
for (const ligne of divergences) console.log(`    ${ligne}`);
verdict(
  'le nombre de trames reçues par un tiers ne dépend pas du secret de J5',
  fluxA.length === fluxB.length,
  `${String(fluxA.length)} contre ${String(fluxB.length)}`,
);
mesure(
  'champs divergents (par type de trame)',
  [...new Set(divergences.map((ligne) => ligne.split('\n')[1]?.trim().slice(3, 40) ?? ''))],
);

titre('(II) Profil de trafic : trames et octets par joueur, sur une partie complète');
const partie = new Banc({ joueurs: 6, graine: 'profil-trafic' });
partie.demarrer();
partie.allerA('NEGOCIATION');
partie.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 2 });
partie.allerA('DECLARATION_PAIEMENT');
partie.declarerPuisPayer([
  [4, 4],
  [4, 2],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
]);
if (partie.etat.phase !== 'ENQUETES_ACCUSATIONS') partie.allerA('ENQUETES_ACCUSATIONS');
partie.exiger('J3', 'lancer_enquete', { cible_joueur_id: 'J1' });
partie.allerA('EXECUTION');

function profil(trames: readonly Trame[]): Record<string, { trames: number; octets: number }> {
  const parJoueur: Record<string, { trames: number; octets: number }> = {};
  for (const trame of trames) {
    const ligne = parJoueur[trame.pour] ?? { trames: 0, octets: 0 };
    parJoueur[trame.pour] = { trames: ligne.trames + 1, octets: ligne.octets + trame.octets };
  }
  return parJoueur;
}

const porteur = partie.manche(1).porteur_clause_joueur_id;
const faiseurs = partie.etat.joueurs.filter((j) => j.role_secret === 'FAISEUR_CONTRATS').map((j) => j.id);
mesure('porteur de la clause (secret permanent)', porteur);
mesure('FAISEUR_CONTRATS (rôle secret)', faiseurs);
mesure('profil global', profil(partie.trames));
mesure(
  'trames clause_recue par joueur',
  Object.fromEntries(partie.joueurs.map((j) => [j, partie.pour(j, 'clause_recue').length])),
);
mesure(
  'trames resultat_enquete par joueur',
  Object.fromEntries(partie.joueurs.map((j) => [j, partie.pour(j, 'resultat_enquete').length])),
);
mesure(
  'trames transfert_enregistre par joueur',
  Object.fromEntries(partie.joueurs.map((j) => [j, partie.pour(j, 'transfert_enregistre').length])),
);

const receveursClause = partie.joueurs.filter((j) => partie.pour(j, 'clause_recue').length > 0);
verdict(
  'la seule présence d’une trame ne désigne pas le porteur ni les Faiseurs de contrats',
  receveursClause.length === partie.joueurs.length || receveursClause.length === 0,
  `seuls ${receveursClause.join('+')} reçoivent une trame clause_recue : un observateur du réseau lit la liste porteur ∪ FAISEUR_CONTRATS`,
);
const receveursEnquete = partie.joueurs.filter((j) => partie.pour(j, 'resultat_enquete').length > 0);
verdict(
  'la présence d’une trame ne désigne pas l’enquêteur',
  receveursEnquete.length === 0,
  `${receveursEnquete.join('+')} est identifié comme enquêteur par le seul volume de trafic (RG-27 : l’existence de l’enquête ne doit être connue que de lui)`,
);

bilan('canaux-indirects');
