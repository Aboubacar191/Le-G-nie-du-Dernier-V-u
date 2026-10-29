// SONDE — critères d'acceptation CA-36 à CA-50 et cas limites de la SPEC.

import { missionReussie } from '@gdv/moteur';
import { CONFIG_DEFAUT } from '@gdv/partage';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

titre('CA-36 — le message de solde ne porte que le solde et les mouvements du destinataire');
const ca36 = new Banc({ joueurs: 6, graine: 'ca-36' });
ca36.demarrer();
ca36.allerA('NEGOCIATION');
ca36.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 3 });
const soldes36 = ca36.pour('J1', 'solde_mis_a_jour');
mesure('dernière charge de solde de J1', soldes36[soldes36.length - 1]?.charge);
const elements = (soldes36[soldes36.length - 1]?.charge as { derniers_mouvements: { elements: { contrepartie_joueur_id: string | null }[] } }).derniers_mouvements.elements;
mesure('clés de la charge', Object.keys(soldes36[soldes36.length - 1]?.charge ?? {}));
verdict(
  'CA-36',
  Object.keys(soldes36[soldes36.length - 1]?.charge ?? {}).length === 2 &&
    elements.every((element) => element.contrepartie_joueur_id === null || element.contrepartie_joueur_id === 'J2'),
);

function partieAvancee(graine: string): Banc {
  const banc = new Banc({ joueurs: 6, graine, mode_avance: true, parties_terminees: 3 });
  banc.demarrer();
  for (let pas = 0; pas < 32 && banc.etat.phase !== 'DV_SIGNATURE'; pas += 1) banc.expirer();
  return banc;
}

titre('CA-37 — mode avancé, 1 signataire');
const ca37 = partieAvancee('ca-37');
const marchandLie = ca37.etat.joueurs.find((joueur) => joueur.role_secret === 'MARCHAND_DEJA_LIE');
const gardien = ca37.etat.joueurs.find((joueur) => joueur.mission_secrete === 'GARDIEN_DE_LA_LAMPE');
mesure('phase atteinte', ca37.etat.phase);
mesure('MARCHAND_DEJA_LIE / GARDIEN_DE_LA_LAMPE', [marchandLie?.id, gardien?.id]);
const soldeSignataire = ca37.solde('J0');
ca37.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
ca37.expirer();
mesure('delta du signataire', ca37.solde('J0') - soldeSignataire);
mesure('genie_libere / vainqueurs', [ca37.etat.genie_libere, ca37.etat.vainqueurs]);
mesure('mission du gardien réussie ?', ca37.etat.joueurs.find((j) => j.id === gardien?.id)?.mission_reussie);
const resolu37 = ca37.trames.filter((trame) => trame.type === 'dernier_voeu_resolu');
mesure('charge publique de résolution', resolu37[0]?.charge);
verdict(
  'CA-37',
  ca37.solde('J0') - soldeSignataire === CONFIG_DEFAUT.recompense_signature_dernier_voeu &&
    ca37.etat.genie_libere === true &&
    JSON.stringify(ca37.etat.vainqueurs) === JSON.stringify([marchandLie?.id]) &&
    ca37.etat.joueurs.find((j) => j.id === gardien?.id)?.mission_reussie === false,
);

titre('CA-38 — mode avancé, 3 signataires');
const ca38 = partieAvancee('ca-38');
const gardien38 = ca38.etat.joueurs.find((joueur) => joueur.mission_secrete === 'GARDIEN_DE_LA_LAMPE');
const soldesAvant38 = ['J0', 'J1', 'J2'].map((joueur) => [joueur, ca38.solde(joueur)] as const);
for (const joueur of ['J0', 'J1', 'J2']) ca38.exiger(joueur, 'signer_dernier_voeu', { a_signe: true });
ca38.expirer();
mesure('soldes avant', soldesAvant38);
mesure('soldes après', ['J0', 'J1', 'J2'].map((joueur) => [joueur, ca38.solde(joueur)]));
mesure('genie_libere', ca38.etat.genie_libere);
mesure('mission du gardien réussie ?', ca38.etat.joueurs.find((j) => j.id === gardien38?.id)?.mission_reussie);
const sanctions38 = ca38.etat.mouvements.filter((m) => m.motif === 'sanction_contrat_conteste');
mesure('sanctions appliquées', sanctions38.map((m) => [m.joueur_id, m.delta]));
verdict(
  'CA-38',
  soldesAvant38.every(([joueur, avant]) => ca38.solde(joueur) === avant - Math.floor(avant / 2)) &&
    ca38.etat.genie_libere === false &&
    ca38.etat.joueurs.find((j) => j.id === gardien38?.id)?.mission_reussie === true &&
    ca38.etat.mouvements.filter((m) => m.motif === 'signature_dernier_voeu').length === 0,
);

titre('CA-39 — aucune trame ne révèle la signature d’un autre avant la résolution');
const ca39 = partieAvancee('ca-39');
const avantSignature = ca39.trames.length;
ca39.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
const pendantSignature = ca39.trames.slice(avantSignature);
mesure('trames projetées par la signature de J0', pendantSignature.map((trame) => [trame.pour, trame.type]));
ca39.expirer();
const resolu39 = ca39.pour('J3', 'dernier_voeu_resolu')[0];
mesure('charge de résolution vue par un non-signataire', resolu39?.charge);
// L'écran de scores publie les identités des signataires : matrice_visibilite
// l'autorise explicitement (« devient_public : ecran de scores finaux »). Il est
// donc exclu de la recherche, qui porte sur la phase de signature elle-même.
const fuiteSignature = ca39
  .pour('J3')
  .filter((trame) => trame.type !== 'scores_finaux')
  .filter((trame) => /a_signe|signataires_ids|ma_signature/.test(JSON.stringify(trame.charge)));
mesure('trames de J3 citant une signature, hors écran de scores', fuiteSignature.map((trame) => trame.type));
mesure(
  'identités de signataires dans scores_finaux (autorisé par la matrice)',
  (ca39.pour('J3', 'scores_finaux')[0]?.charge as { classement?: { joueur_id: string; a_signe_dernier_voeu: boolean | null }[] } | undefined)
    ?.classement?.map((ligne) => [ligne.joueur_id, ligne.a_signe_dernier_voeu]),
);
verdict(
  'CA-39',
  pendantSignature.length === 0 &&
    fuiteSignature.length === 0 &&
    Object.keys(resolu39?.charge ?? {}).includes('nb_signataires'),
);

titre('CA-40 et CA-41 — scores finaux, missions, publication des secrets');
const ca40 = new Banc({ joueurs: 6, graine: 'ca-40' });
ca40.demarrer();
ca40.imposerRole('J5', 'FAISEUR_CONTRATS');
for (let manche = 1; manche <= 5; manche += 1) {
  ca40.allerA('DECLARATION_PAIEMENT');
  const menteur = manche === 1 || manche === 4;
  ca40.joueurs.forEach((joueur) => {
    ca40.exiger(joueur, 'declarer_contribution', { montant: 3 });
  });
  ca40.joueurs.forEach((joueur) => {
    const paye = joueur === 'J5' && menteur ? 1 : 3;
    ca40.exiger(joueur, 'payer_secret', { montant: paye });
  });
  ca40.allerA('EXECUTION');
  ca40.expirer();
}
mesure('état de partie', ca40.etat.etat_partie);
const scores = ca40.pour('J2', 'scores_finaux')[0]?.charge;
mesure('classement publié', (scores as { classement: unknown }).classement);
mesure('clés de la charge de scores', Object.keys(scores ?? {}));
const classement = (scores as { classement: { joueur_id: string; pieces_restantes: number; score_final: number; mission_reussie: boolean; role_secret: string }[] }).classement;
verdict(
  'CA-40 — score = pièces restantes + 10 si mission réussie',
  classement.every(
    (ligne) => ligne.score_final === ligne.pieces_restantes + (ligne.mission_reussie ? CONFIG_DEFAUT.bonus_mission_reussie : 0),
  ),
);
verdict('CA-40 — rôles et missions publiés', classement.every((ligne) => typeof ligne.role_secret === 'string'));
verdict(
  'CA-40 — ni porteur de clause ni enquête dans les scores',
  !/porteur|enquete/i.test(JSON.stringify(scores)),
);
const manchesMenties = ca40.etat.manches.filter(
  (manche) => (manche.contributions.find((c) => c.joueur_id === 'J5')?.montant_declare ?? 0) - (manche.contributions.find((c) => c.joueur_id === 'J5')?.montant_paye ?? 0) > 0,
).length;
mesure('manches menties par J5 / mission', [manchesMenties, ca40.etat.joueurs.find((j) => j.id === 'J5')?.mission_secrete]);
mesure('J5 démasqué ?', ca40.etat.manches.some((m) => m.accusations.some((a) => a.accuse_joueur_id === 'J5' && a.verdict === 'MENTEUR')));
verdict('CA-41 — J5 a menti exactement aux manches 1 et 4', manchesMenties === 2);
const faussaireNonDemasque = missionReussie(ca40.etat, 'J5', 'LE_FAUSSAIRE');
const etatDemasque = {
  ...ca40.etat,
  manches: ca40.etat.manches.map((manche) =>
    manche.numero === 1
      ? {
          ...manche,
          accusations: [
            {
              id: 'audit-1',
              accusateur_joueur_id: 'J0',
              accuse_joueur_id: 'J5',
              verdict: 'MENTEUR' as const,
              ampleur_mensonge: 2,
              montant_amende_du: 4,
              montant_amende_liquide: 4,
              liquide_at: 1,
              cree_at: 1,
            },
          ],
        }
      : manche,
  ),
};
const faussaireDemasque = missionReussie(etatDemasque, 'J5', 'LE_FAUSSAIRE');
mesure('LE_FAUSSAIRE jamais démasqué / démasqué une fois', [faussaireNonDemasque, faussaireDemasque]);
verdict('CA-41 — LE_FAUSSAIRE réussie si jamais démasqué, échouée sinon', faussaireNonDemasque && !faussaireDemasque);

titre('CA-42 — reconnexion en ENQUETES_ACCUSATIONS');
const ca42 = new Banc({ joueurs: 6, graine: 'ca-42' });
ca42.demarrer();
ca42.allerA('DECLARATION_PAIEMENT');
ca42.declarerPuisPayer([
  [4, 4],
  [4, 2],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
]);
if (ca42.etat.phase !== 'ENQUETES_ACCUSATIONS') ca42.allerA('ENQUETES_ACCUSATIONS');
ca42.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
const vue42 = ca42.vuePrivee('J0') as Record<string, unknown>;
mesure('moi', vue42.moi);
mesure('phase / échéance', [vue42.phase, vue42.phase_fin_at]);
const moi42 = vue42.moi as Record<string, unknown>;
verdict(
  'CA-42 — rôle, mission, solde, enquêtes et phase retrouvés',
  moi42.role_secret !== null &&
    moi42.mission_secrete !== null &&
    typeof moi42.solde_pieces === 'number' &&
    Array.isArray(moi42.mes_enquetes_de_la_manche) &&
    (moi42.mes_enquetes_de_la_manche as unknown[]).length === 1 &&
    vue42.phase === 'ENQUETES_ACCUSATIONS' &&
    vue42.phase_fin_at !== null,
);
const vueTiers = JSON.stringify(ca42.vuePrivee('J2'));
verdict(
  'CA-42 — la vue d’un tiers ne contient aucune enquête d’autrui',
  !vueTiers.includes('"cible_joueur_id"'),
);

titre('CA-45 — objectif_par_joueur 4 à 6 joueurs : objectif 24');
const ca45 = new Banc({ joueurs: 6, graine: 'ca-45', config: { objectif_par_joueur: 4 } });
ca45.demarrer();
mesure('objectif de la manche 1', ca45.manche(1).objectif);
mesure('charge voeu_annonce', ca45.pour('J3', 'voeu_annonce')[0]?.charge);
verdict('CA-45', ca45.manche(1).objectif === 24);

titre('CA-47 et CA-48 — compteur de groupe et déblocage du mode avancé');
const ca47 = new Banc({ joueurs: 6, graine: 'ca-47', parties_terminees: 2 });
mesure('parties terminées à la création de la 3e session', ca47.etat.groupe.parties_terminees);
mesure('mode avancé actif', ca47.etat.mode_avance_actif);
ca47.demarrer();
for (let pas = 0; pas < 34 && ca47.etat.etat_partie !== 'TERMINEE'; pas += 1) ca47.expirer();
mesure('compteur après la 3e partie terminée', ca47.etat.groupe.parties_terminees);
const groupeTrame = ca47.pour('J0', 'groupe_mis_a_jour');
mesure('trame de groupe (classe hote)', groupeTrame.map((trame) => trame.charge));
mesure('destinataires de groupe_mis_a_jour', [...new Set(ca47.trames.filter((t) => t.type === 'groupe_mis_a_jour').map((t) => t.pour))]);
verdict(
  'CA-47',
  !ca47.etat.mode_avance_actif &&
    ca47.etat.groupe.parties_terminees === 3 &&
    (groupeTrame[0]?.charge as { groupe: { dernier_voeu_debloque: boolean } }).groupe.dernier_voeu_debloque === true,
);
const ca48 = new Banc({ joueurs: 6, graine: 'ca-48', parties_terminees: 2 });
ca48.demarrer();
ca48.allerA('DECLARATION_PAIEMENT');
ca48.exiger('J0', 'abandonner_partie', { confirmation: true });
mesure('état / compteur après abandon', [ca48.etat.etat_partie, ca48.etat.groupe.parties_terminees]);
mesure('charge d’abandon', ca48.pour('J3', 'partie_abandonnee')[0]?.charge);
mesure('trames de scores après abandon', ca48.trames.filter((t) => t.type === 'scores_finaux').length);
verdict('CA-48', ca48.etat.groupe.parties_terminees === 2 && ca48.trames.filter((t) => t.type === 'scores_finaux').length === 0);

titre('CA-49 — clôture anticipée dès que tous ont déclaré ET payé');
const ca49 = new Banc({ joueurs: 6, graine: 'ca-49' });
ca49.demarrer();
ca49.allerA('DECLARATION_PAIEMENT');
const echeanceAvant = ca49.etat.phase_fin_at;
ca49.joueurs.forEach((joueur) => ca49.exiger(joueur, 'declarer_contribution', { montant: 3 }));
ca49.joueurs.slice(0, 5).forEach((joueur) => ca49.exiger(joueur, 'payer_secret', { montant: 3 }));
mesure('phase après 5 paiements sur 6', ca49.etat.phase);
ca49.exiger('J5', 'payer_secret', { montant: 3 });
mesure('phase après le 6e paiement', ca49.etat.phase);
mesure('échéance du minuteur non atteinte', [ca49.instant < Number(echeanceAvant), echeanceAvant]);
verdict('CA-49', ca49.etat.phase === 'REVELATION' && ca49.instant < Number(echeanceAvant));

titre('CA-50 — aucune commande client n’expose exécution, révélation ni distribution');
const ca50 = new Banc({ joueurs: 6, graine: 'ca-50' });
ca50.demarrer();
ca50.allerA('ENQUETES_ACCUSATIONS');
const interdites = ['executer_pipeline', 'emettre_revelation', 'distribuer', 'executer_manche', 'reveler'];
const resultats50 = interdites.map((commande) => {
  try {
    const resultat = ca50.cmd('J0', commande as never, {});
    return [commande, resultat.ok ? 'ACCEPTEE' : (resultat.erreur as { code: string }).code];
  } catch (erreur) {
    return [commande, `EXCEPTION ${(erreur as Error).message}`];
  }
});
mesure('commandes inventées', resultats50);
verdict('CA-50 — aucune n’est acceptée', resultats50.every(([, code]) => code !== 'ACCEPTEE'));
verdict(
  'CA-50 — le refus est une erreur typée, pas une exception (ARCHI gestion_erreurs)',
  resultats50.every(([, code]) => !String(code).startsWith('EXCEPTION')),
  'appliquerCommande n’a aucune garde sur un type de commande inconnu ; ' +
    'le transport le barre en amont (SchemaEnveloppeCommande), mais la défense en profondeur revendiquée dans commandes/resultat.ts ne couvre pas le TYPE',
);
mesure(
  'commandes de jeu réellement exposées au client',
  ['definir_ordre_places', 'demarrer_partie', 'avancer_phase', 'transferer_pieces', 'proposer_pret', 'repondre_pret', 'declarer_contribution', 'payer_secret', 'lancer_enquete', 'accuser', 'signer_dernier_voeu', 'abandonner_partie'],
);

bilan('criteres-c');
