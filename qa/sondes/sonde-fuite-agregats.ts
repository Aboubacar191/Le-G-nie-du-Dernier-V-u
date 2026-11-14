// SONDE — AXE 1 : inférences par recoupement dans EvtExecutionResultat (classe « tous »).
//
// CONF-02 charge le QA de vérifier qu'aucune inférence AUTRE que le montant
// d'amende ne permet de remonter à un paiement secret. Trois recoupements sont
// mesurés ici, tous sur la SEULE charge publique de l'étape 16 :
//   (1) total_paye et total_consolation publiés ensemble donnent le NOMBRE de
//       paiements impairs : nb_impairs = total_paye − 2 × total_consolation ;
//   (2) les parts publiées sous clause LE_PLUS_GENEREUX trahissent l'argmax des
//       paiements secrets, puisque le poids doublé est lisible dans le rapport
//       des parts alors que les déclarations sont publiques ;
//   (3) bonus_epices_verse — témoin, attendu NON porteur d'information.

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function table(graine: string): Banc {
  const banc = new Banc({ joueurs: 6, graine });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  return banc;
}

function chargePublique(banc: Banc, pour: string): Readonly<Record<string, unknown>> {
  const trame = banc.pour(pour, 'execution_resultat')[0];
  if (trame === undefined) throw new Error('aucune trame execution_resultat');
  return trame.charge;
}

// --- (1) Parité des paiements secrets déduite du total consolé ---------------

titre('(1) CONSOLATION : total_consolation est-il même publié ?');
const echec = table('consolation-parite');
echec.imposerClause('CONSOLATION');
echec.allerA('DECLARATION_PAIEMENT');
// Vœu échoué : 16 payés pour un objectif de 18. Tous déclarent 4 (pair).
echec.declarerPuisPayer([
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 1],
]);
echec.allerA('EXECUTION');
const chargeEchec = chargePublique(echec, 'J2');
mesure('charge publique reçue par J2', chargeEchec);
const nbImpairsReel = echec.manche(1).contributions.filter((c) => (c.montant_paye ?? 0) % 2 === 1).length;
mesure('nb_impairs RÉEL (secret)', nbImpairsReel);
mesure(
  'déclarations publiques (toutes paires)',
  echec.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare]),
);
// RG-74, tenu PAR CONSTRUCTION (voir étape 16/17) : même le total agrégé de
// consolation n'est plus publié du tout — il n'y a donc aucun total_paye −
// 2 × total_consolation à calculer, puisque le second terme n'existe pas.
verdict(
  'total_consolation est ABSENT de la charge publique (RG-74 par construction)',
  !('total_consolation' in chargeEchec),
  `champ trouvé : ${JSON.stringify(chargeEchec.total_consolation)}`,
);

// --- (2) LE_PLUS_GENEREUX : aucune part individuelle n'est publiée ----------

titre('(2) LE_PLUS_GENEREUX : aucune part par joueur n’est publiée (RG-75/81)');
const genereux = table('plus-genereux');
genereux.imposerClause('LE_PLUS_GENEREUX');
genereux.allerA('DECLARATION_PAIEMENT');
genereux.declarerPuisPayer([
  [4, 4],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
]);
genereux.allerA('EXECUTION');
const chargeGenereux = chargePublique(genereux, 'J3');
mesure('charge publique reçue par J3', chargeGenereux);
const declarations = genereux.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare]);
mesure('déclarations publiques', declarations);
const argmaxReel = (() => {
  const contributions = genereux.manche(1).contributions;
  const maximum = Math.max(...contributions.map((c) => c.montant_paye ?? 0));
  return contributions.filter((c) => (c.montant_paye ?? 0) === maximum).map((c) => c.joueur_id);
})();
mesure('argmax RÉEL des paiements (secret, pour mémoire — jamais exposé)', argmaxReel);
// Si une répartition par joueur (« parts ») apparaissait un jour dans cette
// charge, elle trahirait l'argmax des paiements secrets sous cette clause
// (poids doublé du plus généreux lisible malgré des déclarations égales).
// Le seul garde-fou robuste est l'ABSENCE du champ, pas une propriété sur sa
// valeur : c'est ce que ce test prouve, par construction.
verdict(
  'aucun champ de répartition par joueur (parts/parts_individuelles) n’est publié',
  !('parts' in chargeGenereux) && !('parts_individuelles' in chargeGenereux),
  `champs trouvés : ${Object.keys(chargeGenereux).join(', ')}`,
);

// --- (3) Témoin : bonus_epices_verse ----------------------------------------

titre('(3) Témoin bonus_epices_verse — RETIRÉ par ADR-TL-21, et c’est voulu');
// api.json (EvtExecutionResultat.x-retraits-1-2-0.bonus_epices_verse) :
// l'étape 10 verse le bonus pour TOUT joueur de rôle MARCHAND_EPICES, et RG-04
// garantit les quatre rôles toujours présents — donc ce booléen vaut
// IDENTIQUEMENT `reussi`, déjà publié juste à côté. Il n'apporte aucune
// information, et son retrait de la liste fermée de l'étape 16 ne corrige
// aucune fuite : c'est un cas à part des trois autres retraits de l'ADR
// (parts, reliquat_non_distribue, total_consolation), qui eux fermaient des
// ANO mesurées. Le contrat est explicite : une réintégration ne doit jamais
// se faire PAR DÉFAUT — elle doit venir avec sa propre preuve.
const avecMarchand = table('bonus-epices');
avecMarchand.imposerRole('J4', 'MARCHAND_EPICES');
avecMarchand.imposerClause('CONSOLATION');
avecMarchand.allerA('DECLARATION_PAIEMENT');
avecMarchand.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
]);
avecMarchand.allerA('EXECUTION');
const chargeMarchand = chargePublique(avecMarchand, 'J0');
mesure('charge publique avec un marchand', chargeMarchand);
mesure('bonus_epices_verse est-il absent de la charge publique ?', !('bonus_epices_verse' in chargeMarchand));
verdict(
  'bonus_epices_verse est ABSENT de la charge publique (ADR-TL-21)',
  !('bonus_epices_verse' in chargeMarchand),
  `clés trouvées : ${Object.keys(chargeMarchand).join(', ')}`,
);

bilan('fuite-agregats');
