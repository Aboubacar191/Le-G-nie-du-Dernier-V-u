// SONDE — cas_limites de la SPEC, choisis parmi les plus susceptibles de casser.

import { candidatsEligibles, rejoindreSession, selectionnerRevelation } from '@gdv/moteur';
import type { Clause } from '@gdv/partage';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function table(graine: string, clause: Clause, joueurs = 6): Banc {
  const banc = new Banc({ joueurs, graine });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  banc.imposerClause(clause);
  return banc;
}

titre('CL-01 — total payé exactement égal à l’objectif');
const exact = table('cl-01', 'LE_PLUS_GENEREUX');
exact.allerA('DECLARATION_PAIEMENT');
exact.declarerPuisPayer([
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
]);
exact.allerA('EXECUTION');
mesure('objectif / total payé / réussi', [exact.manche(1).objectif, exact.manche(1).total_paye, exact.manche(1).reussi]);
mesure('récompense / parts / reliquat', [exact.manche(1).recompense, exact.manche(1).parts.map((p) => p.part), exact.manche(1).reliquat_non_distribue]);
verdict('CL-01 — succès à l’égalité stricte', exact.manche(1).reussi === true && exact.manche(1).total_paye === 18);

titre('CL-02 et CL-12 — égalité stricte sur le plus gros paiement avec LE_PLUS_GENEREUX');
mesure('paiements tous égaux : poids doublés', exact.manche(1).parts.map((p) => [p.joueur_id, p.part]));
const sommeExact = exact.manche(1).parts.reduce((total, part) => total + part.part, 0);
verdict(
  'CL-12 — tous les ex aequo bénéficient du doublement, parts identiques',
  new Set(exact.manche(1).parts.map((part) => part.part)).size === 1 && sommeExact <= Number(exact.manche(1).recompense),
);

titre('CL-03 — total payé nul');
const nul = table('cl-03', 'TRESOR_DES_HONNETES');
nul.allerA('DECLARATION_PAIEMENT');
nul.allerA('EXECUTION');
mesure('totaux / réussi / récompense', [nul.manche(1).total_declare, nul.manche(1).total_paye, nul.manche(1).reussi, nul.manche(1).recompense]);
mesure('parts', nul.manche(1).parts);
verdict('CL-03', nul.manche(1).total_paye === 0 && nul.manche(1).reussi === false && nul.manche(1).recompense === 0);

titre('CL-04 — tous les joueurs mentent (COMPTAGE interdit à k == nb_joueurs)');
const tous = table('cl-04', 'TRESOR_DES_HONNETES');
tous.allerA('DECLARATION_PAIEMENT');
tous.declarerPuisPayer([
  [4, 1],
  [4, 1],
  [4, 1],
  [4, 1],
  [4, 1],
  [4, 1],
]);
const candidatsTous = candidatsEligibles(tous.etat, tous.manche(1));
mesure('gabarits éligibles', [...new Set(candidatsTous.map((candidat) => candidat.gabarit))]);
mesure('sélection', selectionnerRevelation(tous.etat, tous.manche(1))?.gabarit ?? null);
verdict('CL-04 — COMPTAGE écarté quand k == nb_joueurs', !candidatsTous.some((candidat) => candidat.gabarit === 'COMPTAGE'));

titre('CL-05 — somme des poids nulle : tous les contributeurs démasqués');
const poidsNuls = table('cl-05', 'TRESOR_DES_HONNETES');
poidsNuls.allerA('DECLARATION_PAIEMENT');
// Vœu RÉUSSI (18 payés pour 18) et les SIX contributeurs démasqués : chacun
// accuse son voisin en cycle, les six verdicts sont MENTEUR, donc tous les
// poids tombent à 0 alors que la récompense, elle, existe.
poidsNuls.declarerPuisPayer([
  [6, 3],
  [6, 3],
  [6, 3],
  [6, 3],
  [6, 3],
  [6, 3],
]);
if (poidsNuls.etat.phase !== 'ENQUETES_ACCUSATIONS') poidsNuls.allerA('ENQUETES_ACCUSATIONS');
poidsNuls.joueurs.forEach((joueur, index) => {
  const cible = poidsNuls.joueurs[(index + 1) % poidsNuls.joueurs.length] ?? '';
  poidsNuls.exiger(joueur, 'accuser', { accuse_joueur_id: cible });
});
mesure('verdicts', poidsNuls.manche(1).accusations.map((a) => [a.accuse_joueur_id, a.verdict]));
const soldesAvant = poidsNuls.joueurs.map((joueur) => poidsNuls.solde(joueur));
poidsNuls.allerA('EXECUTION');
mesure('réussi / récompense', [poidsNuls.manche(1).reussi, poidsNuls.manche(1).recompense]);
mesure('parts', poidsNuls.manche(1).parts.map((part) => [part.joueur_id, part.part, part.exclu_du_partage]));
mesure('reliquat non distribué', poidsNuls.manche(1).reliquat_non_distribue);
mesure('mouvements de part', poidsNuls.etat.mouvements.filter((m) => m.motif === 'part_recompense').length);
mesure('soldes avant / après', [soldesAvant, poidsNuls.joueurs.map((joueur) => poidsNuls.solde(joueur))]);
verdict(
  'CL-05 — aucune part versée, aucun solde négatif, reliquat = récompense',
  poidsNuls.etat.mouvements.filter((m) => m.motif === 'part_recompense').length === 0 &&
    poidsNuls.manche(1).reliquat_non_distribue === poidsNuls.manche(1).recompense &&
    poidsNuls.etat.joueurs.every((joueur) => joueur.solde_pieces >= 0),
);

titre('CL-07 — pénalité de fausse accusation supérieure au solde de l’accusateur');
const penalite = table('cl-07', 'TRESOR_DES_HONNETES');
penalite.allerA('NEGOCIATION');
penalite.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J4', montant: 11 });
penalite.allerA('ENQUETES_ACCUSATIONS');
mesure('solde de l’accusateur', penalite.solde('J0'));
penalite.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
penalite.allerA('EXECUTION');
const mouvementsPenalite = penalite.etat.mouvements.filter((m) => /penalite_fausse/.test(m.motif));
mesure('mouvements', mouvementsPenalite.map((m) => [m.joueur_id, m.delta, m.motif]));
mesure('soldes après', [penalite.solde('J0'), penalite.solde('J1')]);
verdict(
  'CL-07 — pénalité plafonnée au solde, aucun négatif',
  penalite.solde('J0') === 0 && penalite.etat.joueurs.every((joueur) => joueur.solde_pieces >= 0),
);

titre('CL-09 et CL-10 — deux FAISEUR_CONTRATS, puis porteur lui-même faiseur');
const deuxFaiseurs = new Banc({ joueurs: 6, graine: 'cl-09' });
deuxFaiseurs.demarrer();
for (const joueur of deuxFaiseurs.joueurs) deuxFaiseurs.imposerRole(joueur, 'PRETEUR');
deuxFaiseurs.imposerRole('J1', 'FAISEUR_CONTRATS');
deuxFaiseurs.imposerRole('J2', 'FAISEUR_CONTRATS');
deuxFaiseurs.etat = {
  ...deuxFaiseurs.etat,
  manches: deuxFaiseurs.etat.manches.map((manche) => ({ ...manche, porteur_clause_joueur_id: 'J4' })),
};
mesure(
  'destinataires autorisés de la clause (vue privée)',
  deuxFaiseurs.joueurs.map((joueur) => [joueur, (deuxFaiseurs.vuePrivee(joueur) as { moi: { clause_connue: string | null } }).moi.clause_connue !== null]),
);
const autorises = deuxFaiseurs.joueurs.filter(
  (joueur) => (deuxFaiseurs.vuePrivee(joueur) as { moi: { clause_connue: string | null } }).moi.clause_connue !== null,
);
verdict('CL-09 — porteur + les deux faiseurs, et personne d’autre', JSON.stringify(autorises) === JSON.stringify(['J1', 'J2', 'J4']));
deuxFaiseurs.etat = {
  ...deuxFaiseurs.etat,
  manches: deuxFaiseurs.etat.manches.map((manche) => ({ ...manche, porteur_clause_joueur_id: 'J1' })),
};
const autorises2 = deuxFaiseurs.joueurs.filter(
  (joueur) => (deuxFaiseurs.vuePrivee(joueur) as { moi: { clause_connue: string | null } }).moi.clause_connue !== null,
);
mesure('porteur = faiseur J1 : autorisés', autorises2);
verdict('CL-10 — aucun doublon de destinataire', JSON.stringify(autorises2) === JSON.stringify(['J1', 'J2']));

titre('CL-11 — deux INSPECTEUR_TRESOR : coût réduit pour les deux');
const deuxInspecteurs = table('cl-11', 'TRESOR_DES_HONNETES');
deuxInspecteurs.imposerRole('J0', 'INSPECTEUR_TRESOR');
deuxInspecteurs.imposerRole('J1', 'INSPECTEUR_TRESOR');
deuxInspecteurs.allerA('ENQUETES_ACCUSATIONS');
const avantEnquetes = [deuxInspecteurs.solde('J0'), deuxInspecteurs.solde('J1'), deuxInspecteurs.solde('J2')];
deuxInspecteurs.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J5' });
deuxInspecteurs.exiger('J1', 'lancer_enquete', { cible_joueur_id: 'J5' });
deuxInspecteurs.exiger('J2', 'lancer_enquete', { cible_joueur_id: 'J5' });
mesure('coûts prélevés [J0 insp, J1 insp, J2 non insp]', [
  avantEnquetes[0] - deuxInspecteurs.solde('J0'),
  avantEnquetes[1] - deuxInspecteurs.solde('J1'),
  avantEnquetes[2] - deuxInspecteurs.solde('J2'),
]);
verdict(
  'CL-11',
  avantEnquetes[0] - deuxInspecteurs.solde('J0') === 1 &&
    avantEnquetes[1] - deuxInspecteurs.solde('J1') === 1 &&
    avantEnquetes[2] - deuxInspecteurs.solde('J2') === 2,
);

titre('CL-13 et CL-14 — égalité de score final et LE_MAGNAT en doublon');
const egalite = new Banc({ joueurs: 6, graine: 'cl-13' });
egalite.demarrer();
for (const joueur of egalite.joueurs) egalite.imposerMission(joueur, 'LE_MAGNAT');
for (let pas = 0; pas < 34 && egalite.etat.etat_partie !== 'TERMINEE'; pas += 1) egalite.expirer();
mesure('classement', egalite.etat.classement);
mesure('vainqueurs', egalite.etat.vainqueurs);
mesure('missions réussies', egalite.etat.joueurs.map((joueur) => [joueur.id, joueur.mission_secrete, joueur.mission_reussie]));
verdict(
  'CL-13 — les ex aequo partagent le rang 1',
  (egalite.etat.classement ?? []).every((ligne) => ligne.rang === 1),
);
verdict('CL-14 — LE_MAGNAT réussie pour tous les ex aequo', egalite.etat.joueurs.every((joueur) => joueur.mission_reussie === true));

titre('CL-15 — aucun gabarit de révélation éligible');
const minuscule = new Banc({ joueurs: 2, graine: 'cl-15', config: { joueurs_min: 2, joueurs_max: 2 } });
minuscule.demarrer();
minuscule.allerA('DECLARATION_PAIEMENT');
minuscule.declarerPuisPayer([
  [2, 2],
  [2, 2],
]);
mesure('contributions', minuscule.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare, c.montant_paye]));
mesure('candidats éligibles', candidatsEligibles(minuscule.etat, minuscule.manche(1)).map((c) => c.gabarit));
mesure('sélection', selectionnerRevelation(minuscule.etat, minuscule.manche(1)));
if (minuscule.etat.phase !== 'REVELATION' && minuscule.etat.phase !== 'ENQUETES_ACCUSATIONS') minuscule.allerA('REVELATION');
mesure('révélations émises', minuscule.manche(1).revelations.length);
mesure('écart total émis malgré tout', minuscule.pour('J1', 'revelation_ecart_total').length);
verdict(
  'CL-15 — rien d’autre que l’écart total n’est émis',
  minuscule.manche(1).revelations.length === 0 && minuscule.pour('J1', 'revelation_ecart_total').length === 1,
);
const cinq = table('cl-15b', 'TRESOR_DES_HONNETES', 5);
cinq.allerA('DECLARATION_PAIEMENT');
cinq.declarerPuisPayer([
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
]);
mesure(
  'à 5 joueurs tous honnêtes, candidats restants',
  candidatsEligibles(cinq.etat, cinq.manche(1)).map((c) => `${c.gabarit}:${c.cibles.join('+')}`),
);

titre('CL-18 — double soumission de la déclaration, puis du paiement');
const doubleSoumission = table('cl-18', 'TRESOR_DES_HONNETES');
doubleSoumission.allerA('DECLARATION_PAIEMENT');
doubleSoumission.exiger('J0', 'declarer_contribution', { montant: 4 });
const remplacement = doubleSoumission.cmd('J0', 'declarer_contribution', { montant: 6 });
mesure('seconde déclaration avant paiement', remplacement.ok ? 'ACCEPTEE (remplacement)' : (remplacement.erreur as { code: string }).code);
mesure('montant déclaré retenu', doubleSoumission.manche(1).contributions.find((c) => c.joueur_id === 'J0')?.montant_declare);
doubleSoumission.exiger('J0', 'payer_secret', { montant: 2 });
const apresPaiement = doubleSoumission.cmd('J0', 'declarer_contribution', { montant: 3 });
const secondPaiement = doubleSoumission.cmd('J0', 'payer_secret', { montant: 1 });
mesure('déclaration après paiement', apresPaiement.ok ? 'ACCEPTEE' : (apresPaiement.erreur as { code: string }).code);
mesure('second paiement', secondPaiement.ok ? 'ACCEPTEE' : (secondPaiement.erreur as { code: string }).code);
verdict('CL-18 — RG-70 respectée', remplacement.ok && !apresPaiement.ok && !secondPaiement.ok);

titre('CL-20 — voisinage sur un cercle de 5 et de 8');
for (const effectif of [5, 8]) {
  const cercle = table(`cl-20-${String(effectif)}`, 'TRESOR_DES_HONNETES', effectif);
  cercle.allerA('DECLARATION_PAIEMENT');
  const couples = Array.from({ length: effectif }, (_, index) => [4, index === 0 ? 1 : 4] as const);
  cercle.declarerPuisPayer(couples);
  const voisinage = candidatsEligibles(cercle.etat, cercle.manche(1)).filter((c) => c.gabarit === 'VOISINAGE');
  mesure(`cercle de ${String(effectif)} : cibles VOISINAGE`, voisinage.map((c) => c.cibles[0]));
  verdict(`CL-20 — exactement 2 voisins du menteur à ${String(effectif)} joueurs`, voisinage.length === 2);
}

titre('CL-24 — abandon en pleine manche 3 : aucun secret révélé');
const abandon = table('cl-24', 'TRESOR_DES_HONNETES');
abandon.allerA('EXECUTION');
abandon.expirer();
abandon.allerA('EXECUTION');
abandon.expirer();
mesure('manche courante', abandon.etat.manche_courante);
abandon.exiger('J0', 'abandonner_partie', { confirmation: true });
mesure('état / phase', [abandon.etat.etat_partie, abandon.etat.phase]);
mesure('classement calculé ?', abandon.etat.classement);
const apresAbandon = abandon.pour('J3').filter((trame) => trame.type === 'scores_finaux' || trame.type === 'partie_abandonnee');
mesure('trames finales reçues par J3', apresAbandon.map((trame) => [trame.type, trame.charge]));
verdict(
  'CL-24 — aucun classement, aucune trame de scores',
  abandon.etat.classement === null && apresAbandon.every((trame) => trame.type === 'partie_abandonnee'),
);

titre('CL-25 — deux sessions actives avec le même pseudo');
const sessionA = new Banc({ joueurs: 6, graine: 'cl-25-a' });
const doublon = rejoindreSession(sessionA.etat, { joueur_id: 'J9', pseudo: 'P1' });
mesure('même pseudo dans la MÊME session', doublon.ok ? 'ACCEPTE' : doublon.code);
const sessionB = new Banc({ joueurs: 6, graine: 'cl-25-b' });
mesure('pseudos de la session B', sessionB.etat.joueurs.map((joueur) => joueur.pseudo));
verdict(
  'CL-25 — refusé dans la même session, accepté dans une autre',
  !doublon.ok && doublon.code === 'PSEUDO_INDISPONIBLE' && sessionB.etat.joueurs.some((joueur) => joueur.pseudo === 'P1'),
);

bilan('cas-limites');
