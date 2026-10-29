// SONDE — critères d'acceptation CA-01 à CA-21, remesurés par le QA.
// Session, placement, distribution, déclaration, paiement, clause, révélations.

import {
  candidatsEligibles,
  creerSession,
  distribuer,
  creerAleaSfc32,
  rejoindreSession,
  verifierEnonce,
  type EtatSession,
} from '@gdv/moteur';
import { CONFIG_DEFAUT } from '@gdv/partage';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function session(nb: number): EtatSession {
  let etat = creerSession({
    session_id: 's',
    code_adhesion: 'ABCDEF',
    config: CONFIG_DEFAUT,
    mode_avance_actif: false,
    groupe: { id: 'g', parties_terminees: 0, parties_requises: 3 },
    hote: { joueur_id: 'J0', pseudo: 'Hote' },
    maintenant: 1,
  });
  for (let i = 1; i < nb; i += 1) {
    const adhesion = rejoindreSession(etat, { joueur_id: `J${i}`, pseudo: `P${i}` });
    if (adhesion.ok) etat = adhesion.etat;
  }
  return etat;
}

titre('CA-01 — code d’adhésion, états CREEE puis SALLE_ATTENTE');
const creee = session(1);
mesure('état après création', [creee.etat_partie, creee.code_adhesion, creee.joueurs.length]);
const avecUn = session(2);
mesure('état après le premier joueur rejoint', avecUn.etat_partie);
verdict('CA-01', creee.etat_partie === 'CREEE' && avecUn.etat_partie === 'SALLE_ATTENTE' && creee.code_adhesion.length > 0);

titre('CA-02 — démarrage refusé à 4 joueurs');
const quatre = new Banc({ joueurs: 4, graine: 'ca-02' });
const refusDemarrage = quatre.cmd('J0', 'demarrer_partie');
mesure('code', refusDemarrage.ok ? 'ACCEPTEE' : (refusDemarrage.erreur as { code: string }).code);
mesure('état de partie après refus', quatre.etat.etat_partie);
verdict('CA-02', !refusDemarrage.ok && quatre.etat.etat_partie === 'SALLE_ATTENTE');

titre('CA-03 — 9e joueur refusé');
const huit = session(8);
const neuvieme = rejoindreSession(huit, { joueur_id: 'J8', pseudo: 'P8' });
mesure('résultat', neuvieme.ok ? 'ACCEPTE' : neuvieme.code);
verdict('CA-03', !neuvieme.ok && neuvieme.code === 'SESSION_PLEINE');

titre('CA-04 — ordre des places incomplet ou dupliqué');
const placement = new Banc({ joueurs: 6, graine: 'ca-04' });
placement.exiger('J0', 'demarrer_partie');
const omis = placement.cmd('J0', 'definir_ordre_places', { ordre: ['J0', 'J1', 'J2', 'J3', 'J4'] });
const duplique = placement.cmd('J0', 'definir_ordre_places', { ordre: ['J0', 'J0', 'J1', 'J2', 'J3', 'J4'] });
mesure('omission', omis.ok ? 'ACCEPTEE' : (omis.erreur as { code: string }).code);
mesure('duplication', duplique.ok ? 'ACCEPTEE' : (duplique.erreur as { code: string }).code);
mesure('état de partie', placement.etat.etat_partie);
verdict('CA-04', !omis.ok && !duplique.ok && placement.etat.etat_partie === 'PLACEMENT');

titre('CA-05 — aucun message reçu par A ne porte le rôle ou la mission d’un autre');
const distribution = new Banc({ joueurs: 6, graine: 'ca-05' });
distribution.demarrer();
const attributions = distribution.pour('J0', 'attribution_privee');
mesure('attributions reçues par J0', attributions.map((trame) => trame.charge));
const j0 = distribution.etat.joueurs.find((joueur) => joueur.id === 'J0');
const autres = distribution.etat.joueurs.filter((joueur) => joueur.id !== 'J0');
const flux = JSON.stringify(distribution.pour('J0').map((trame) => trame.charge));
const fuites = autres.filter((joueur) => {
  const roleAutre = joueur.role_secret !== j0?.role_secret && flux.includes(String(joueur.role_secret));
  const missionAutre = joueur.mission_secrete !== j0?.mission_secrete && flux.includes(String(joueur.mission_secrete));
  return roleAutre || missionAutre;
});
mesure('rôles et missions de la table', distribution.etat.joueurs.map((joueur) => [joueur.id, joueur.role_secret, joueur.mission_secrete]));
mesure('fuites détectées', fuites.map((joueur) => joueur.id));
verdict('CA-05', attributions.length === 1 && fuites.length === 0);

titre('CA-06 — 4 rôles présents, aucun au-delà de 2, 1 rôle et 1 mission par joueur');
for (const effectif of [5, 6, 7, 8]) {
  const distribue = distribuer(
    { ...session(effectif), etat_partie: 'DISTRIBUTION' },
    creerAleaSfc32(`ca-06-${String(effectif)}`),
    { identifiant: () => 'x', maintenant: 1 },
  );
  const comptage = new Map<string, number>();
  for (const joueur of distribue.joueurs) {
    comptage.set(String(joueur.role_secret), (comptage.get(String(joueur.role_secret)) ?? 0) + 1);
  }
  const tous = distribue.joueurs.every((joueur) => joueur.role_secret !== null && joueur.mission_secrete !== null);
  mesure(`effectif ${String(effectif)}`, [...comptage.entries()]);
  verdict(
    `CA-06 à ${String(effectif)} joueurs`,
    comptage.size === 4 && [...comptage.values()].every((n) => n <= 2) && tous,
  );
}

titre('CA-07 — déclarer plus que son solde');
const ca07 = new Banc({ joueurs: 6, graine: 'ca-07' });
ca07.demarrer();
ca07.allerA('DECLARATION_PAIEMENT');
const trop = ca07.cmd('J0', 'declarer_contribution', { montant: 13 });
mesure('code', trop.ok ? 'ACCEPTEE' : (trop.erreur as { code: string }).code);
mesure('trames declaration_publiee émises', ca07.trames.filter((t) => t.type === 'declaration_publiee').length);
verdict('CA-07', !trop.ok && ca07.trames.filter((t) => t.type === 'declaration_publiee').length === 0);

titre('CA-08 — la déclaration est publiée à tous');
ca07.exiger('J0', 'declarer_contribution', { montant: 4 });
const publiees = ca07.trames.filter((trame) => trame.type === 'declaration_publiee');
mesure('destinataires', publiees.map((trame) => trame.pour));
mesure('charge', publiees[0]?.charge);
verdict('CA-08', publiees.length === 6 && Number((publiees[0]?.charge as { montant_declare: number }).montant_declare) === 4);

titre('CA-09 — payer plus que déclaré');
const paiementTrop = ca07.cmd('J0', 'payer_secret', { montant: 5 });
mesure('code', paiementTrop.ok ? 'ACCEPTEE' : (paiementTrop.erreur as { code: string }).code);
verdict('CA-09', !paiementTrop.ok);

titre('CA-10 — le montant payé n’apparaît dans aucune trame d’autrui');
const ca10 = new Banc({ joueurs: 6, graine: 'ca-10' });
ca10.demarrer();
ca10.allerA('DECLARATION_PAIEMENT');
ca10.exiger('J0', 'declarer_contribution', { montant: 4 });
ca10.exiger('J0', 'payer_secret', { montant: 1 });
for (const joueur of ['J1', 'J2', 'J3', 'J4', 'J5']) {
  ca10.exiger(joueur, 'declarer_contribution', { montant: 4 });
  ca10.exiger(joueur, 'payer_secret', { montant: 4 });
}
ca10.allerA('EXECUTION');
const porteursDuUn = ['J1', 'J2', 'J3', 'J4', 'J5'].flatMap((joueur) =>
  ca10
    .pour(joueur)
    .filter((trame) => /(^|[^0-9])1([^0-9]|$)/.test(JSON.stringify(trame.charge)))
    .map((trame) => `${joueur}/${trame.type}`),
);
mesure('trames d’autrui contenant le littéral 1', [...new Set(porteursDuUn)]);
const champsPaye = ['J1', 'J2', 'J3', 'J4', 'J5'].flatMap((joueur) =>
  ca10.pour(joueur).filter((trame) => JSON.stringify(trame.charge).includes('montant_paye')).map((t) => t.type),
);
mesure('trames d’autrui portant un champ montant_paye', [...new Set(champsPaye)]);
verdict('CA-10 (aucun champ de paiement chez autrui)', champsPaye.length === 0);

titre('CA-11 — non-soumission : déclaré 0 / payé 0 (RG-32)');
const ca11 = new Banc({ joueurs: 6, graine: 'ca-11' });
ca11.demarrer();
ca11.allerA('DECLARATION_PAIEMENT');
ca11.exiger('J0', 'declarer_contribution', { montant: 3 });
ca11.exiger('J0', 'payer_secret', { montant: 3 });
ca11.allerA('REVELATION');
mesure('contributions matérialisées', ca11.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare, c.montant_paye]));
verdict(
  'CA-11',
  ca11.manche(1).contributions.length === 6 &&
    ca11.manche(1).contributions.filter((c) => c.joueur_id !== 'J0').every((c) => c.montant_declare === 0 && c.montant_paye === 0),
);

titre('CA-12 — la clause va au porteur et aux FAISEUR_CONTRATS, à personne d’autre');
const ca12 = new Banc({ joueurs: 6, graine: 'ca-12' });
ca12.demarrer();
const porteur = ca12.manche(1).porteur_clause_joueur_id;
const faiseurs = ca12.etat.joueurs.filter((joueur) => joueur.role_secret === 'FAISEUR_CONTRATS').map((j) => j.id);
const recoivent = ca12.joueurs.filter((joueur) => ca12.pour(joueur, 'clause_recue').length > 0);
mesure('porteur', porteur);
mesure('faiseurs de contrats', faiseurs);
mesure('destinataires effectifs', recoivent);
mesure('charge reçue par le porteur', ca12.pour(porteur, 'clause_recue')[0]?.charge);
verdict('CA-12', JSON.stringify([...recoivent].sort()) === JSON.stringify([...new Set([porteur, ...faiseurs])].sort()));
verdict(
  'CA-12 — la charge ne nomme jamais le porteur',
  ca12.joueurs.every((joueur) => {
    const charge = ca12.pour(joueur, 'clause_recue')[0]?.charge;
    return charge === undefined || !Object.keys(charge).includes('porteur_joueur_id');
  }),
);

titre('CA-13 — 5 clauses distinctes sur une partie');
const ca13 = new Banc({ joueurs: 6, graine: 'ca-13' });
ca13.demarrer();
for (let pas = 0; pas < 32 && ca13.etat.etat_partie !== 'TERMINEE'; pas += 1) ca13.expirer();
const clauses = ca13.etat.manches.map((manche) => manche.clause_cle);
mesure('clauses tirées', clauses);
verdict('CA-13', clauses.length === 5 && new Set(clauses).size === 5);

titre('CA-14 — écart total publié à tous, avec les deux valeurs exactes');
const ca14 = new Banc({ joueurs: 6, graine: 'ca-14' });
ca14.demarrer();
ca14.allerA('DECLARATION_PAIEMENT');
ca14.declarerPuisPayer([
  [6, 4],
  [5, 4],
  [4, 3],
  [4, 3],
  [4, 3],
  [3, 2],
]);
ca14.allerA('REVELATION');
const ecarts = ca14.trames.filter((trame) => trame.type === 'revelation_ecart_total');
mesure('charge', ecarts[0]?.charge);
mesure('destinataires', ecarts.map((trame) => trame.pour));
verdict(
  'CA-14',
  ecarts.length === 6 &&
    Number((ecarts[0]?.charge as { total_declare: number }).total_declare) === 26 &&
    Number((ecarts[0]?.charge as { total_paye: number }).total_paye) === 19,
);

titre('CA-15 — personne n’a menti : COMPTAGE interdit (k == 0)');
const ca15 = new Banc({ joueurs: 6, graine: 'ca-15' });
ca15.demarrer();
ca15.allerA('DECLARATION_PAIEMENT');
ca15.declarerPuisPayer([
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
]);
if (ca15.etat.phase !== 'REVELATION' && ca15.etat.phase !== 'ENQUETES_ACCUSATIONS') ca15.allerA('REVELATION');
const candidats15 = candidatsEligibles(ca15.etat, ca15.manche(1));
mesure('gabarits éligibles', [...new Set(candidats15.map((candidat) => candidat.gabarit))]);
mesure('révélation émise', ca15.manche(1).revelations.map((revelation) => revelation.gabarit));
verdict('CA-15', !candidats15.some((candidat) => candidat.gabarit === 'COMPTAGE'));

titre('CA-16 — toute révélation émise est vérifiée vraie et laisse >= 2 suspects');
const ca16 = new Banc({ joueurs: 6, graine: 'ca-16' });
ca16.demarrer();
for (let pas = 0; pas < 32 && ca16.etat.etat_partie !== 'TERMINEE'; pas += 1) ca16.expirer();
const toutes = ca16.etat.manches.flatMap((manche) => manche.revelations.map((revelation) => ({ manche, revelation })));
mesure(
  'révélations de la partie',
  toutes.map((ligne) => [ligne.manche.numero, ligne.revelation.gabarit, ligne.revelation.suspects_restants_apres, ligne.revelation.verifiee_vraie]),
);
const reverifiees = toutes.every((ligne) => verifierEnonce(ca16.etat, ligne.manche, ligne.revelation));
verdict('CA-16 — revérification indépendante vraie', reverifiees);
verdict('CA-16 — suspects restants >= 2', toutes.every((ligne) => ligne.revelation.suspects_restants_apres >= 2));

titre('CA-17 — PASSE indisponible avant la manche 3 (manche_min_revelation_passe)');
mesure('manche_min_revelation_passe', CONFIG_DEFAUT.manche_min_revelation_passe);
const passeAvant = ca16.etat.manches
  .filter((manche) => manche.numero < CONFIG_DEFAUT.manche_min_revelation_passe)
  .flatMap((manche) => candidatsEligibles(ca16.etat, manche).filter((c) => c.gabarit === 'PASSE'));
mesure('candidats PASSE aux manches 1 et 2', passeAvant.length);
verdict('CA-17', passeAvant.length === 0);

titre('CA-18 — VOISINAGE : seul F a menti, la cible A est éligible et non accusée');
const ca18 = new Banc({ joueurs: 6, graine: 'ca-18' });
ca18.demarrer(['J0', 'J1', 'J2', 'J3', 'J4', 'J5']);
ca18.allerA('DECLARATION_PAIEMENT');
ca18.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 1],
]);
const voisinage = candidatsEligibles(ca18.etat, ca18.manche(1)).filter((c) => c.gabarit === 'VOISINAGE');
mesure('ordre du cercle', ca18.etat.joueurs.map((joueur) => [joueur.id, joueur.position_cercle]));
mesure('cibles VOISINAGE éligibles', voisinage.map((candidat) => candidat.cibles));
verdict('CA-18', voisinage.some((candidat) => candidat.cibles[0] === 'J0') && voisinage.every((c) => c.cibles[0] !== 'J5'));

titre('CA-19 à CA-21 — enquête : coût, résultat privé, refus si solde insuffisant');
const ca19 = new Banc({ joueurs: 6, graine: 'ca-19' });
ca19.demarrer();
ca19.imposerRole('J0', 'MARCHAND_EPICES');
ca19.imposerRole('J1', 'INSPECTEUR_TRESOR');
ca19.imposerRole('J2', 'MARCHAND_EPICES');
ca19.allerA('NEGOCIATION');
ca19.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J3', montant: 10 });
ca19.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J3', montant: 11 });
ca19.exiger('J2', 'transferer_pieces', { cible_joueur_id: 'J3', montant: 11 });
ca19.allerA('DECLARATION_PAIEMENT');
ca19.exiger('J5', 'declarer_contribution', { montant: 5 });
ca19.exiger('J5', 'payer_secret', { montant: 2 });
ca19.allerA('ENQUETES_ACCUSATIONS');
mesure('soldes avant enquête', [ca19.solde('J0'), ca19.solde('J1'), ca19.solde('J2')]);
const enquete19 = ca19.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J5' });
mesure('CA-19 solde de J0 après enquête', ca19.solde('J0'));
mesure('CA-19 résultat reçu par J0', ca19.pour('J0', 'resultat_enquete')[0]?.charge);
mesure('CA-19 trames reçues par la cible J5', ca19.pour('J5', 'resultat_enquete').length);
verdict('CA-19', enquete19.ok && ca19.solde('J0') === 0 && ca19.pour('J5', 'resultat_enquete').length === 0);
const enquete20 = ca19.cmd('J1', 'lancer_enquete', { cible_joueur_id: 'J5' });
mesure('CA-20 inspecteur : résultat', enquete20.ok ? 'ACCEPTEE' : (enquete20.erreur as { code: string }).code);
mesure('CA-20 solde de l’inspecteur après enquête', ca19.solde('J1'));
verdict('CA-20', enquete20.ok && ca19.solde('J1') === 0);
const enquete21 = ca19.cmd('J2', 'lancer_enquete', { cible_joueur_id: 'J5' });
mesure('CA-21 non-inspecteur à 1 pièce', enquete21.ok ? 'ACCEPTEE' : (enquete21.erreur as { code: string }).code);
mesure('CA-21 solde inchangé', ca19.solde('J2'));
verdict('CA-21', !enquete21.ok && ca19.solde('J2') === 1);

bilan('criteres-a');
