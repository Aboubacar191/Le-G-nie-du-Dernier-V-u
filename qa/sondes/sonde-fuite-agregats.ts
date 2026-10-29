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

titre('(1) CONSOLATION : nb_impairs = total_paye − 2 × total_consolation');
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
const totalPaye = Number(chargeEchec.total_paye);
const totalConsolation = Number(chargeEchec.total_consolation);
const nbImpairsDeduit = totalPaye - 2 * totalConsolation;
const nbImpairsReel = echec.manche(1).contributions.filter((c) => (c.montant_paye ?? 0) % 2 === 1).length;
mesure('nb_impairs DÉDUIT du public', nbImpairsDeduit);
mesure('nb_impairs RÉEL (secret)', nbImpairsReel);
mesure(
  'déclarations publiques (toutes paires)',
  echec.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare]),
);
verdict(
  'le total consolé ne permet pas de retrouver la parité des paiements',
  nbImpairsDeduit !== nbImpairsReel,
  `déduit ${String(nbImpairsDeduit)} = réel ${String(nbImpairsReel)} : parité reconstituée`,
);
verdict(
  'les 6 joueurs ne sont pas tous désignés menteurs par ce recoupement',
  !(nbImpairsDeduit === 6 && echec.manche(1).contributions.every((c) => c.montant_declare % 2 === 0)),
  'déclaration paire + paiement impair ⇒ menteur prouvé, pour les 6 joueurs ; ' +
    'c’est exactement ce que le gabarit COMPTAGE interdit à k == nb_joueurs',
);

// --- (2) LE_PLUS_GENEREUX : l'argmax des paiements secrets devient public ----

titre('(2) LE_PLUS_GENEREUX : les parts publiées trahissent le plus gros payeur');
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
const parts = chargeGenereux.parts as readonly { joueur_id: string; part: number }[];
const declarations = genereux.manche(1).contributions.map((c) => [c.joueur_id, c.montant_declare]);
mesure('déclarations publiques', declarations);

// Inférence d'un tiers : poids_i reconstruit depuis part_i, recompense et somme.
const recompense = Number(chargeGenereux.recompense);
const partMax = Math.max(...parts.map((part) => part.part));
const partMin = Math.min(...parts.map((part) => part.part));
const doubles = parts.filter((part) => part.part === partMax).map((part) => part.joueur_id);
mesure('recompense publique', recompense);
mesure('parts publiées', parts.map((part) => [part.joueur_id, part.part]));
mesure('joueurs à poids doublé déduits (part maximale)', doubles);
const argmaxReel = (() => {
  const contributions = genereux.manche(1).contributions;
  const maximum = Math.max(...contributions.map((c) => c.montant_paye ?? 0));
  return contributions.filter((c) => (c.montant_paye ?? 0) === maximum).map((c) => c.joueur_id);
})();
mesure('argmax RÉEL des paiements (secret)', argmaxReel);
verdict(
  'les parts publiées ne révèlent pas l’argmax des paiements secrets',
  JSON.stringify(doubles) !== JSON.stringify(argmaxReel) || partMax === partMin,
  `déduit ${doubles.join('+')} = réel ${argmaxReel.join('+')} (parts ${String(partMax)} contre ${String(partMin)} à déclarations égales)`,
);
verdict(
  'les autres joueurs ne sont pas prouvés menteurs par ce recoupement',
  doubles.length !== 1 || new Set(declarations.map((ligne) => ligne[1])).size !== 1,
  'argmax unique + déclarations toutes égales ⇒ payé(i) < payé(argmax) <= déclaré(i) ' +
    'pour les 5 autres, donc les 5 autres ont menti',
);

// --- (3) Témoin : bonus_epices_verse ----------------------------------------

titre('(3) Témoin bonus_epices_verse (attendu : sans information)');
mesure('bonus_epices_verse hors marchand', chargeGenereux.bonus_epices_verse);
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
mesure('bonus_epices_verse avec un marchand', chargeMarchand.bonus_epices_verse);
mesure(
  'le champ est-il un booléen (et non un montant) ?',
  typeof chargeMarchand.bonus_epices_verse,
);
verdict(
  'bonus_epices_verse ne porte aucun montant ni aucun nombre de bénéficiaires',
  typeof chargeMarchand.bonus_epices_verse === 'boolean',
);

bilan('fuite-agregats');
