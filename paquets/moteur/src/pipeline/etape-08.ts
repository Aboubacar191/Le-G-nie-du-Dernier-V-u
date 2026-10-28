// Étape 8 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[7] :
//   poids_i = montant_declare_i pour tout joueur non exclu, 0 sinon ;
//   si clause LE_PLUS_GENEREUX active, poids_i *= 2 pour tout joueur non exclu
//   appartenant à argmax(montant_paye).
//
// Condition : reussi
//
// RG-14 : le partage se fait au prorata des montants DÉCLARÉS, pas payés.
// Cas d'égalité sur le plus gros paiement réel : TOUS les ex aequo bénéficient
// du doublement (catalogue_clauses, cas_egalite déduit par la SPEC).
// Le facteur de doublement appartient à l'énoncé de la clause, pas à
// l'équilibrage : il est nommé ici et lu nulle part ailleurs.

import { declareDe, payeDe } from '../etat/acces.ts';
import { clauseActive, manchePipeline, type ContexteExecution } from './contexte.ts';

const FACTEUR_PLUS_GENEREUX = 2;

export function etape08(contexte: ContexteExecution): ContexteExecution {
  if (!contexte.reussi) return contexte;
  const manche = manchePipeline(contexte);
  const exclus = new Set(contexte.exclus);
  const paiements = contexte.etat.joueurs.map((joueur) => payeDe(manche, joueur.id));
  const paiementMaximum = paiements.length === 0 ? 0 : Math.max(...paiements);
  const genereux = clauseActive(contexte, 'LE_PLUS_GENEREUX');

  const poids = new Map<string, number>();
  for (const joueur of contexte.etat.joueurs) {
    if (exclus.has(joueur.id)) {
      poids.set(joueur.id, 0);
      continue;
    }
    const base = declareDe(manche, joueur.id);
    const double = genereux && payeDe(manche, joueur.id) === paiementMaximum;
    poids.set(joueur.id, double ? base * FACTEUR_PLUS_GENEREUX : base);
  }
  return { ...contexte, poids };
}

export type Etape08 = typeof etape08;
