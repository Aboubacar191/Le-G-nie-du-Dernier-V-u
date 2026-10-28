// Enchaînements de transitions — ce que le temps et les clôtures déclenchent.
//
// Ajout du nœud S4 dans le répertoire que l'ARCHI consacre aux machines à
// états : partie.ts porte la TABLE des transitions admises, manche.ts l'ORDRE
// des phases, et ce fichier les ENCHAÎNEMENTS. Les trois tiennent séparément
// sous la limite de 300 lignes ; mêlés, ils ne se relisent plus.
//
// Aucune de ces fonctions n'est atteignable depuis une commande client : ouvrir
// une manche, émettre une révélation, exécuter le pipeline et distribuer sont
// produits exclusivement par le moteur, sur expiration de minuteur ou sur
// transition (CA-50).

import type { Effet } from '../etat/effets.ts';
import { exigerMancheCourante, mancheCourante } from '../etat/acces.ts';
import type { ContexteEcriture } from '../etat/mouvements.ts';
import type { ContexteMoteur, EtatSession, Manche } from '../etat/types.ts';
import { tirerClause } from '../distribution/clauses.ts';
import { tirerPorteur } from '../distribution/porteur.ts';
import { executerPipeline } from '../pipeline/index.ts';
import { emettreRevelation } from '../revelations/selection.ts';
import { finDePhase, phaseSuivante } from './manche.ts';

export interface Transition {
  readonly etat: EtatSession;
  readonly effets: readonly Effet[];
}

export function ecritureDe(contexte: ContexteMoteur): ContexteEcriture {
  return { identifiant: contexte.identifiant, maintenant: contexte.horloge.maintenant() };
}

function mancheVierge(
  numero: number,
  objectif: number,
  clause: Manche['clause_cle'],
  porteur: string,
): Manche {
  return {
    numero,
    objectif,
    clause_cle: clause,
    porteur_clause_joueur_id: porteur,
    contributions: [],
    enquetes: [],
    accusations: [],
    revelations: [],
    total_declare: null,
    total_paye: null,
    reussi: null,
    recompense: null,
    multiplicateur_applique: null,
    facteur_amende: null,
    parts: [],
    reliquat_non_distribue: null,
    consolation_appliquee: false,
    total_consolation: null,
    bonus_epices_verse: false,
    cloture: false,
    cloture_at: null,
  };
}

/**
 * Ouvre la manche `numero` : tirage de la clause (sans remise) puis du porteur,
 * dans cet ordre — l'ordre de consommation de l'aléa est normatif. L'objectif
 * vaut objectif_par_joueur × nb_joueurs (RG-07, CA-45).
 */
export function ouvrirManche(
  etat: EtatSession,
  numero: number,
  contexte: ContexteMoteur,
): Transition {
  const tirage = tirerClause(etat, contexte.alea);
  const porteur = tirerPorteur(tirage.etat, contexte.alea);
  const objectif = etat.config.objectif_par_joueur * etat.joueurs.length;
  const maintenant = contexte.horloge.maintenant();

  const manche = mancheVierge(numero, objectif, tirage.clause, porteur);
  const avecManche: EtatSession = {
    ...tirage.etat,
    etat_partie: 'MANCHE_EN_COURS',
    manche_courante: numero,
    manches: [...tirage.etat.manches, manche],
    phase: 'VOEU',
    phase_fin_at: finDePhase('VOEU', etat.config, maintenant),
  };

  return {
    etat: avecManche,
    effets: [
      { type: 'etat_partie_change' },
      { type: 'voeu_annonce', numero_manche: numero },
      {
        type: 'clause_recue',
        numero_manche: numero,
        clause: tirage.clause,
        porteur_joueur_id: porteur,
      },
      { type: 'phase_changee' },
    ],
  };
}

/** RG-32 : à l'expiration, les contributions non soumises sont matérialisées à 0. */
function materialiserContributions(etat: EtatSession, manche: Manche): Manche {
  return {
    ...manche,
    contributions: etat.joueurs.map((joueur) => {
      const existante = manche.contributions.find((c) => c.joueur_id === joueur.id);
      return {
        joueur_id: joueur.id,
        montant_declare: existante?.montant_declare ?? 0,
        montant_paye: existante?.montant_paye ?? 0,
        declare_at: existante?.declare_at ?? null,
        paye_at: existante?.paye_at ?? null,
      };
    }),
  };
}

/**
 * Entrée en phase REVELATION : publication systématique de l'écart total, puis
 * AU PLUS une révélation du catalogue. C'est aussi le moment où total_paye
 * devient public (matrice_visibilite) : il est donc écrit dans la manche ici,
 * et pas avant.
 */
function entrerEnRevelation(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const manche = materialiserContributions(etat, exigerMancheCourante(etat));
  const totalDeclare = manche.contributions.reduce((t, c) => t + c.montant_declare, 0);
  const totalPaye = manche.contributions.reduce((t, c) => t + (c.montant_paye ?? 0), 0);
  const chiffree: Manche = { ...manche, total_declare: totalDeclare, total_paye: totalPaye };

  const avecTotaux: EtatSession = {
    ...etat,
    manches: etat.manches.map((m) => (m.numero === chiffree.numero ? chiffree : m)),
  };

  const effets: Effet[] = [
    { type: 'phase_changee' },
    {
      type: 'revelation_ecart_total',
      numero_manche: chiffree.numero,
      total_declare: totalDeclare,
      total_paye: totalPaye,
    },
  ];

  const emission = emettreRevelation(avecTotaux, chiffree, {
    alea: contexte.alea,
    maintenant: contexte.horloge.maintenant(),
    identifiant: contexte.identifiant,
  });
  if (emission === null) return { etat: avecTotaux, effets };

  return {
    etat: emission.etat,
    effets: [
      ...effets,
      { type: 'revelation', numero_manche: chiffree.numero, revelation: emission.revelation },
    ],
  };
}

/** Entrée en phase EXECUTION : le pipeline des 17 étapes, puis la clôture. */
function entrerEnExecution(etat: EtatSession, contexte: ContexteMoteur): Transition {
  const resultat = executerPipeline(etat, etat.manche_courante, ecritureDe(contexte));
  return {
    etat: resultat.etat,
    effets: [{ type: 'phase_changee' }, ...resultat.effets],
  };
}

/** Avance d'une phase dans la séquence courante, en exécutant son traitement d'entrée. */
export function avancerDUnePhase(etat: EtatSession, contexte: ContexteMoteur): Transition | null {
  if (etat.phase === null) return null;
  const suivante = phaseSuivante(etat.phase);
  if (suivante === null) return null;

  const maintenant = contexte.horloge.maintenant();
  const avance: EtatSession = {
    ...etat,
    phase: suivante,
    phase_fin_at: finDePhase(suivante, etat.config, maintenant),
  };

  if (suivante === 'REVELATION') return entrerEnRevelation(avance, contexte);
  if (suivante === 'EXECUTION') return entrerEnExecution(avance, contexte);
  return { etat: avance, effets: [{ type: 'phase_changee' }] };
}

/** La manche courante est-elle terminée, c'est-à-dire clôturée par le pipeline ? */
export function mancheClose(etat: EtatSession): boolean {
  return mancheCourante(etat)?.cloture === true;
}
