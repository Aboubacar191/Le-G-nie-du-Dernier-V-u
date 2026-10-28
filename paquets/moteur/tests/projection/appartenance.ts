// Outillage de la propriété (P-b) : APPARTENANCE.
//
// « Pour toute clé dont le couple (entite, champ) figure dans
//   registre_champs_secrets, la VALEUR émise appartient au destinataire, ou le
//   destinataire relève de la classe x-visibilite déclarée par l'événement pour
//   cette donnée. La propriété porte sur le couple QUALIFIÉ et sur le
//   PROPRIÉTAIRE de la valeur, PAS sur la présence d'un nom nu : c'est ce qui la
//   rend vraie sur les événements publics, donc utilisable. »
//   (ARCHI seuils_qualite.interdits_mecaniques, ADR-TL-18)
//
// La table ci-dessous est le pont entre les deux formes qualifiées que l'ARCHI
// distingue : (entite, champ) côté données, (schéma, champ) côté protocole. Elle
// est écrite à la main, avec un motif par ligne, parce que c'est précisément la
// décision qu'aucun outil ne peut deviner — et parce qu'un nom nu y mènerait à
// des faux positifs sur joueur_id, sequence ou motif (mesuré par ADR-TL-18 :
// joueur_id apparaît dans 11 schémas du protocole, dont une déclaration
// publiée).
//
// La LIBÉRATION TEMPORELLE n'est pas portée ici : elle est portée, et uniquement
// elle, par la classe x-visibilite de l'ÉVÉNEMENT qui transporte la donnée
// (ARCHI registre_champs_secrets.liberation_temporelle). D'où le champ
// `publie_par`, qui énumère des TYPES D'ÉVÉNEMENT et jamais une date.

import { CHAMPS_SECRETS_PAR_ENTITE, type EntiteSecrete, type TypeEvenement } from '@gdv/partage';
import type { EtatSession } from '@gdv/moteur';

export interface RegleAppartenance {
  /** Entité du registre dont ce champ du protocole transporte la donnée. */
  readonly entite: EntiteSecrete;
  /** Champ de l'entité, sous sa forme qualifiée. */
  readonly champ: string;
  /** Valeurs que CE destinataire a le droit de voir sous ce nom. */
  readonly valeursAutorisees: (etat: EtatSession, destinataire: string) => ReadonlySet<unknown>;
  /** Événements dont la classe x-visibilite libère la donnée pour tous. */
  readonly publie_par: readonly TypeEvenement[];
  readonly motif: string;
}

const vide = (): ReadonlySet<unknown> => new Set();

function soi(etat: EtatSession, destinataire: string): EtatSession['joueurs'][number] | undefined {
  return etat.joueurs.find((joueur) => joueur.id === destinataire);
}

/** Paiements que le destinataire a le droit de connaître : les siens et ceux qu'il a achetés. */
function paiementsLicites(etat: EtatSession, destinataire: string): ReadonlySet<unknown> {
  const autorises = new Set<unknown>();
  for (const manche of etat.manches) {
    const sienne = manche.contributions.find((c) => c.joueur_id === destinataire);
    if (sienne?.montant_paye !== null && sienne?.montant_paye !== undefined) {
      autorises.add(sienne.montant_paye);
    }
    for (const enquete of manche.enquetes) {
      if (enquete.enqueteur_joueur_id !== destinataire) continue;
      autorises.add(enquete.resultat_montant_paye);
    }
  }
  return autorises;
}

function clausesLicites(etat: EtatSession, destinataire: string): ReadonlySet<unknown> {
  const autorisees = new Set<unknown>();
  const moi = soi(etat, destinataire);
  for (const manche of etat.manches) {
    const estPorteur = manche.porteur_clause_joueur_id === destinataire;
    const estFaiseur = moi?.role_secret === 'FAISEUR_CONTRATS';
    if (estPorteur || estFaiseur || manche.cloture) autorisees.add(manche.clause_cle);
  }
  return autorisees;
}

function pretsLicites(
  etat: EtatSession,
  destinataire: string,
  extraire: (pret: EtatSession['prets'][number]) => unknown,
): ReadonlySet<unknown> {
  const autorises = new Set<unknown>();
  for (const pret of etat.prets) {
    if (pret.preteur_joueur_id !== destinataire && pret.emprunteur_joueur_id !== destinataire) {
      continue;
    }
    autorises.add(extraire(pret));
  }
  return autorises;
}

/**
 * Table (champ du protocole) → règle d'appartenance.
 * Un champ absent de cette table est NEUTRE : il ne transporte aucune donnée du
 * registre. La neutralité est vérifiée séparément, contre les champs secrets
 * qui ne doivent apparaître sous AUCUN nom (voir CHAMPS_JAMAIS_EMIS).
 */
export const REGLES_APPARTENANCE: Readonly<Record<string, RegleAppartenance>> = {
  role_secret: {
    entite: 'joueurs',
    champ: 'role_secret',
    valeursAutorisees: (etat, destinataire) => new Set([soi(etat, destinataire)?.role_secret]),
    publie_par: ['scores_finaux'],
    motif: 'matrice_visibilite : serveur et propriétaire, public à l’écran de scores (RG-58).',
  },
  mission_secrete: {
    entite: 'joueurs',
    champ: 'mission_secrete',
    valeursAutorisees: (etat, destinataire) => new Set([soi(etat, destinataire)?.mission_secrete]),
    publie_par: ['scores_finaux'],
    motif: 'matrice_visibilite : serveur et propriétaire, public à l’écran de scores (RG-58).',
  },
  solde_pieces: {
    entite: 'joueurs',
    champ: 'solde_pieces',
    valeursAutorisees: (etat, destinataire) => new Set([soi(etat, destinataire)?.solde_pieces]),
    publie_par: [],
    motif: 'ADR-CP-05 : un solde public permettrait de déduire le paiement par différence.',
  },
  pieces_restantes: {
    entite: 'joueurs',
    champ: 'solde_pieces',
    valeursAutorisees: (etat, destinataire) => new Set([soi(etat, destinataire)?.solde_pieces]),
    publie_par: ['scores_finaux'],
    motif: 'Même donnée que solde_pieces, libérée à l’écran de scores (RG-58).',
  },
  solde_apres: {
    entite: 'mouvements_pieces',
    champ: 'solde_apres',
    valeursAutorisees: (etat, destinataire) =>
      new Set(
        etat.mouvements
          .filter((mouvement) => mouvement.joueur_id === destinataire)
          .map((mouvement) => mouvement.solde_apres),
      ),
    publie_par: [],
    motif: 'CA-36 : le journal de pièces est strictement privé.',
  },
  montant_paye: {
    entite: 'contributions',
    champ: 'montant_paye',
    valeursAutorisees: paiementsLicites,
    publie_par: ['scores_finaux'],
    motif: 'CA-10 : LE secret du jeu. Sort vers son propriétaire, vers l’enquêteur, et aux scores.',
  },
  clause: {
    entite: 'manches',
    champ: 'clause_cle',
    valeursAutorisees: clausesLicites,
    publie_par: [],
    motif: 'RG-18 : porteur et FAISEUR_CONTRATS, puis tous à l’étape 16.',
  },
  clause_connue: {
    entite: 'manches',
    champ: 'clause_cle',
    valeursAutorisees: clausesLicites,
    publie_par: [],
    motif: 'Idem clause, dans la vue privée.',
  },
  clause_revelee: {
    entite: 'manches',
    champ: 'clause_cle',
    valeursAutorisees: clausesLicites,
    publie_par: ['execution_resultat'],
    motif: 'Libérée par l’étape 16 (EvtExecutionResultat, classe tous).',
  },
  principal: {
    entite: 'prets',
    champ: 'principal',
    valeursAutorisees: (etat, destinataire) =>
      pretsLicites(etat, destinataire, (pret) => pret.principal),
    publie_par: [],
    motif: 'matrice_visibilite : un prêt est visible du prêteur et de l’emprunteur seuls.',
  },
  du_total: {
    entite: 'prets',
    champ: 'du_total',
    valeursAutorisees: (etat, destinataire) =>
      pretsLicites(etat, destinataire, (pret) => pret.du_total),
    publie_par: [],
    motif: 'Idem principal.',
  },
  rembourse: {
    entite: 'prets',
    champ: 'rembourse',
    valeursAutorisees: (etat, destinataire) =>
      pretsLicites(etat, destinataire, (pret) => pret.rembourse),
    publie_par: [],
    motif: 'Idem principal.',
  },
  a_signe_dernier_voeu: {
    entite: 'signatures_dernier_voeu',
    champ: 'a_signe',
    valeursAutorisees: (etat, destinataire) =>
      new Set(
        etat.signatures
          .filter((signature) => signature.joueur_id === destinataire)
          .map((signature) => signature.a_signe),
      ),
    publie_par: ['scores_finaux'],
    motif: 'RG-54 / CA-39 : les identités ne sortent qu’à l’écran de scores.',
  },
  ma_signature_dernier_voeu: {
    entite: 'signatures_dernier_voeu',
    champ: 'a_signe',
    valeursAutorisees: (etat, destinataire) =>
      new Set(
        etat.signatures
          .filter((signature) => signature.joueur_id === destinataire)
          .map((signature) => signature.a_signe),
      ),
    publie_par: [],
    motif: 'Sa propre signature, et celle de personne d’autre.',
  },
  cout_paye: {
    entite: 'enquetes',
    champ: 'cout_paye',
    valeursAutorisees: (etat, destinataire) =>
      new Set(
        etat.manches.flatMap((manche) =>
          manche.enquetes
            .filter((enquete) => enquete.enqueteur_joueur_id === destinataire)
            .map((enquete) => enquete.cout_paye),
        ),
      ),
    publie_par: [],
    motif: 'RG-27 : l’entité enquete est ENTIÈREMENT secrète, sauf pour son enquêteur.',
  },
  score_activite: {
    entite: 'joueurs',
    champ: 'score_activite',
    valeursAutorisees: vide,
    publie_par: [],
    motif: 'Jamais émis : il laisse deviner les enquêtes lancées, qui sont secrètes (RG-27).',
  },
};

/**
 * Champs qui ne doivent apparaître sous AUCUN nom, dans AUCUN message, à aucun
 * moment. Ce ne sont pas des valeurs à vérifier mais des NOMS à interdire.
 */
export const CHAMPS_JAMAIS_EMIS: readonly string[] = [
  'ampleur_mensonge', // RG-75 : jamais un champ, pas même à l'écran de scores
  'porteur_clause_joueur_id', // matrice_visibilite : jamais en v1
  'graine_alea', // secret de premier rang : la connaître permet de tout recalculer
  'jeton_session', // ADR-TL-15
  'jeton_session_hache',
  'jeton_hote_hache',
  'jeton_groupe',
  'score_activite',
  'charge_json',
  'facteur_amende', // divulguerait PRIME_AU_DELATEUR avant l'étape 16
  'paye_at', // l'instant de paiement est une information de comportement
  'resultat_montant_paye',
  'enqueteur_joueur_id',
];

/** Les 13 entités du registre sont bien celles du contrat d'architecture. */
export const ENTITES_DU_REGISTRE = Object.keys(CHAMPS_SECRETS_PAR_ENTITE) as EntiteSecrete[];
