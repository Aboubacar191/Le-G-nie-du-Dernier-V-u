// SONDE — AXE 1 : sonde différentielle secret par secret.
//
// Méthode : deux exécutions STRICTEMENT identiques — même graine, même suite de
// commandes — sauf UN secret. On diffe ensuite les flux reçus par un TIERS. Une
// divergence est une dépendance mesurée du flux d'un tiers à ce secret ; c'est
// la seule façon de détecter une fuite par recoupement, qu'aucun contrôle de
// champ ne voit.
//
// Secrets éprouvés : rôle secret, identité du porteur de clause, existence
// d'une enquête (RG-27, « devient_public : jamais en v1 »).

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function fluxDe(banc: Banc, joueur: string): readonly string[] {
  return banc.pour(joueur).map((trame) => `${trame.type} ${JSON.stringify(trame.charge)}`);
}

function diff(a: readonly string[], b: readonly string[]): readonly string[] {
  const ecarts: string[] = [];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) ecarts.push(`#${String(index)} A=${String(a[index])} | B=${String(b[index])}`);
  }
  return ecarts;
}

// --- (1) Rôle secret : permutation des rôles entre deux joueurs -------------

titre('(1) Rôle secret : les rôles de J4 et J5 sont permutés');
function bancRoles(permute: boolean): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'diff-roles' });
  banc.demarrer();
  banc.imposerRole('J0', 'INSPECTEUR_TRESOR');
  banc.imposerRole('J1', 'FAISEUR_CONTRATS');
  banc.imposerRole('J2', 'MARCHAND_EPICES');
  banc.imposerRole('J3', 'MARCHAND_EPICES');
  banc.imposerRole('J4', permute ? 'PRETEUR' : 'INSPECTEUR_TRESOR');
  banc.imposerRole('J5', permute ? 'INSPECTEUR_TRESOR' : 'PRETEUR');
  banc.imposerClause('CONSOLATION');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  banc.allerA('EXECUTION');
  return banc;
}
const rolesA = bancRoles(false);
const rolesB = bancRoles(true);
const ecartsRoles = diff(fluxDe(rolesA, 'J1'), fluxDe(rolesB, 'J1'));
mesure('rôles cas A', rolesA.etat.joueurs.map((joueur) => [joueur.id, joueur.role_secret]));
mesure('rôles cas B', rolesB.etat.joueurs.map((joueur) => [joueur.id, joueur.role_secret]));
mesure('divergences dans le flux du tiers J1', ecartsRoles);
verdict('le flux d’un tiers est insensible à la permutation des rôles', ecartsRoles.length === 0);

// --- (2) Identité du porteur de la clause -----------------------------------

titre('(2) Porteur de la clause : J3 contre J4 (secret permanent, jamais public)');
function bancPorteur(porteur: string): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'diff-porteur' });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'MARCHAND_EPICES');
  banc.imposerClause('CONSOLATION');
  banc.etat = {
    ...banc.etat,
    manches: banc.etat.manches.map((manche) =>
      manche.numero === 1 ? { ...manche, porteur_clause_joueur_id: porteur } : manche,
    ),
  };
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  banc.allerA('EXECUTION');
  return banc;
}
const porteurA = bancPorteur('J3');
const porteurB = bancPorteur('J4');
const ecartsPorteur = diff(fluxDe(porteurA, 'J1'), fluxDe(porteurB, 'J1'));
mesure('divergences dans le flux du tiers J1', ecartsPorteur);
verdict('le flux d’un tiers est insensible à l’identité du porteur', ecartsPorteur.length === 0);
mesure(
  'le porteur apparaît-il dans une charge publique ?',
  porteurA.trames
    .filter((trame) => JSON.stringify(trame.charge).includes('"J3"'))
    .map((trame) => trame.type),
);

// --- (3) Existence d'une enquête : canal indirect par le score d'activité ----

titre('(3) Enquête SECRÈTE de J2 à la manche 1 : effet sur la révélation PUBLIQUE de la manche 2');
function bancEnquete(avecEnquete: boolean): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'diff-enquete' });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'MARCHAND_EPICES');
  // Manche 1 : tout le monde est honnête, personne ne ment.
  banc.imposerClause('CONSOLATION');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
  ]);
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  if (avecEnquete) banc.exiger('J2', 'lancer_enquete', { cible_joueur_id: 'J0' });
  banc.allerA('EXECUTION');
  banc.expirer();
  // Manche 2 : J5 est le seul menteur.
  banc.imposerClause('TRESOR_DES_HONNETES');
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 1],
  ]);
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  return banc;
}
const sansEnquete = bancEnquete(false);
const avecEnquete = bancEnquete(true);
mesure(
  'scores d’activité sans enquête',
  sansEnquete.etat.joueurs.map((joueur) => [joueur.id, joueur.score_activite]),
);
mesure(
  'scores d’activité avec enquête',
  avecEnquete.etat.joueurs.map((joueur) => [joueur.id, joueur.score_activite]),
);
const revelationSans = sansEnquete.pour('J4', 'revelation').map((trame) => trame.charge);
const revelationAvec = avecEnquete.pour('J4', 'revelation').map((trame) => trame.charge);
mesure('révélations publiques vues par le tiers J4, sans enquête', revelationSans);
mesure('révélations publiques vues par le tiers J4, avec enquête', revelationAvec);
const identiques = JSON.stringify(revelationSans) === JSON.stringify(revelationAvec);
verdict(
  'la révélation publique ne dépend pas de l’existence d’une enquête secrète',
  identiques,
  'le choix de cible du génie suit score_activite = 3×accusations + 2×enquêtes + 1×transferts ; ' +
    'les accusations sont publiques, les enquêtes et les transferts ne le sont pas',
);
const ecartsEnquete = diff(fluxDe(sansEnquete, 'J4'), fluxDe(avecEnquete, 'J4'));
mesure('divergences totales dans le flux du tiers J4', ecartsEnquete.length);
for (const ligne of ecartsEnquete) console.log(`    ${ligne}`);

// --- (4) Reconnexion : état complet projeté (CA-42, RG-73) ------------------

titre('(4) Reconnexion : la vue privée d’un joueur contient-elle un secret d’autrui ?');
const vue = avecEnquete.vuePrivee('J4');
const texte = JSON.stringify(vue);
mesure('taille de la vue privée de J4 (octets)', texte.length);
mesure('bloc moi', (vue as { moi?: unknown } | null)?.moi ?? null);
const ROLES = ['INSPECTEUR_TRESOR', 'FAISEUR_CONTRATS', 'PRETEUR', 'MARCHAND_EPICES', 'MARCHAND_DEJA_LIE'];
const occurrencesRole = ROLES.filter((role) => texte.includes(role));
mesure('rôles cités dans la vue privée de J4', occurrencesRole);
verdict(
  'aucun rôle autre que le sien n’apparaît',
  occurrencesRole.length <= 1 && occurrencesRole[0] === avecEnquete.etat.joueurs.find((j) => j.id === 'J4')?.role_secret,
);
mesure('clés de premier niveau', Object.keys(vue ?? {}));
const mancheVue = (vue as { manche_courante?: Record<string, unknown> } | null)?.manche_courante ?? {};
mesure('manche_courante exposée', Object.keys(mancheVue));
verdict(
  'la manche courante ne porte ni enquêtes ni porteur de clause',
  !Object.keys(mancheVue).includes('enquetes') && !Object.keys(mancheVue).includes('porteur_clause_joueur_id'),
);
mesure('mes_enquetes_de_la_manche de J4 (non enquêteur)', (vue as { moi?: { mes_enquetes_de_la_manche?: unknown } } | null)?.moi?.mes_enquetes_de_la_manche);
const vueEnqueteur = avecEnquete.vuePrivee('J2');
mesure('mes_enquetes_de_la_manche de J2 (enquêteur manche 1, manche courante 2)', (vueEnqueteur as { moi?: { mes_enquetes_de_la_manche?: unknown } } | null)?.moi?.mes_enquetes_de_la_manche);
verdict(
  'la vue privée ne contient aucun paiement individuel d’autrui',
  !/"montant_paye":(?!null)/.test(JSON.stringify((vue as { manche_courante?: unknown } | null)?.manche_courante ?? {})),
);

bilan('differentielle-secrets');
