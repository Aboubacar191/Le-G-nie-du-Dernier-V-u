// SONDE — AXE 1 : le gabarit COMPARAISON désigne nommément un menteur.
//
// Énoncé publié : « {a} a payé plus que {b} », événement EvtRevelation de classe
// « tous » (cibles = [a, b]).
//
// Raisonnement d'un joueur quelconque, à partir des SEULES données publiques :
//   payé(b) < payé(a)            (l'énoncé, vérifié vrai par le génie, RG-20)
//   payé(a) <= déclaré(a)        (RG-09, borne du paiement, connue de la table)
//   donc payé(b) < déclaré(a)
//   si déclaré(b) >= déclaré(a)  (les déclarations sont PUBLIQUES, RG-31)
//   alors payé(b) < déclaré(b)   donc b A MENTI, nommément, avec certitude.
//
// Attendu SPEC, catalogue_revelations / COMPARAISON : « interdit si l'énoncé
// combiné aux déclarations publiques suffit à désigner un menteur unique ».

import { candidatsEligibles, declareDe, payeDe, selectionnerRevelation } from '@gdv/moteur';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

const DECLARATION_COMMUNE = 4;

/** Table où J5 ment et possède le plus haut score d'activité (loi 3, RG-22). */
function bancComparaison(): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'fuite-comparaison' });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  banc.imposerClause('CONSOLATION');
  banc.allerA('NEGOCIATION');
  // Un transfert émis vaut 1 point d'activité (RG-24) : J5 passe en tête.
  banc.exiger('J5', 'transferer_pieces', { cible_joueur_id: 'J0', montant: 1 });
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [DECLARATION_COMMUNE, 4],
    [DECLARATION_COMMUNE, 4],
    [DECLARATION_COMMUNE, 4],
    [DECLARATION_COMMUNE, 4],
    [DECLARATION_COMMUNE, 4],
    [DECLARATION_COMMUNE, 1],
  ]);
  return banc;
}

titre('Scénario : 6 joueurs, tous déclarent 4, seul J5 ment (paie 1)');
const banc = bancComparaison();
const manche = banc.manche(1);
mesure('scores d’activité', banc.etat.joueurs.map((joueur) => [joueur.id, joueur.score_activite]));
mesure('déclarations publiques', manche.contributions.map((c) => [c.joueur_id, c.montant_declare]));
mesure('paiements (secrets)', manche.contributions.map((c) => [c.joueur_id, c.montant_paye]));

const candidats = candidatsEligibles(banc.etat, manche);
mesure(
  'candidats éligibles',
  candidats.map((candidat) => [candidat.gabarit, candidat.cibles.join('+')]),
);
const choisi = selectionnerRevelation(banc.etat, manche);
mesure('révélation SÉLECTIONNÉE', choisi === null ? null : [choisi.gabarit, choisi.cibles]);

titre('Trame réellement émise à tous les joueurs');
const emises = banc.trames.filter((trame) => trame.type === 'revelation');
mesure('nombre de destinataires', new Set(emises.map((trame) => trame.pour)).size);
mesure('charge reçue par J1 (tiers non concerné)', banc.pour('J1', 'revelation')[0]?.charge ?? null);

/** Inférence menée par un tiers, avec les seules déclarations publiques. */
function menteurDesigne(cibles: readonly string[]): string | null {
  const [a, b] = cibles;
  if (a === undefined || b === undefined) return null;
  const declareA = declareDe(manche, a);
  const declareB = declareDe(manche, b);
  return declareB >= declareA ? b : null;
}

const cibles = choisi?.cibles ?? [];
const designe = menteurDesigne(cibles);
mesure('menteur désigné par inférence publique', designe);
mesure(
  'vérification contre les paiements réels',
  designe === null ? null : declareDe(manche, designe) - payeDe(manche, designe) > 0,
);

verdict(
  'aucun menteur nommément désigné par une révélation COMPARAISON publiée',
  designe === null,
  designe === null ? '' : `${designe} est désigné menteur à coup sûr par la seule trame publique`,
);

titre('Ampleur de la faille : part des candidats COMPARAISON qui fuient');
const comparaisons = candidats.filter((candidat) => candidat.gabarit === 'COMPARAISON');
const fuyants = comparaisons.filter((candidat) => menteurDesigne(candidat.cibles) !== null);
mesure('candidats COMPARAISON', comparaisons.length);
mesure('candidats COMPARAISON qui désignent un menteur', fuyants.length);
mesure('paires fuyantes', fuyants.map((candidat) => candidat.cibles.join(' > ')));
verdict('aucun candidat COMPARAISON ne désigne un menteur', fuyants.length === 0);

titre('Garde existante du moteur : designeUnMenteurUnique ne couvre que |suspects| == 2');
mesure('nombre de suspects publics de la manche', banc.etat.joueurs.length);
mesure(
  'garde déclenchée ?',
  comparaisons.length > 0 ? 'non — tous les candidats sont passés' : 'oui',
);

bilan('fuite-comparaison');
