// =============================================================================
// CONFIGURATION DE JEU — RG-60 / CA-46
// =============================================================================
// « TOUTES les valeurs de parametres_configuration vivent dans
//   paquets/partage/src/config/defauts.json. Aucune n'apparaît en littéral dans
//   le code du moteur » (ARCHI conventions.configuration_de_jeu).
//
// Les 21 paramètres de SPEC-GDV-001.json / parametres_configuration sont dans
// defauts.json, et nulle part ailleurs. Ce fichier n'en expose que le TYPE et
// la valeur chargée : aucun calcul, aucune règle.
//
// Une seule représentation diffère de la SPEC, sur décision du tech-lead
// (ADR-TL-14, points_tranches_sans_consultation) : taux_interet_pret vaut
// [1, 2] — rationnel [numerateur, denominateur] — au lieu de 0.5. Valeur
// numériquement identique, flottant éliminé. fraction_retenue_genie [1, 3] et
// fraction_consolation [1, 2] suivent la même représentation, déjà celle de la
// SPEC. API-GDV-001.json/ConfigJeuPublique déclare bien ces trois paramètres
// comme Rationnel.
//
// AMORCE — nœud S4 : le schéma Zod avec bornes se dérive de
// API-GDV-001.json/ConfigJeuPublique (chaque propriété y porte déjà son minimum
// et son maximum) et de BornesConfiguration. Aucune borne n'est à inventer ici.

import type { Phase } from '../domaine/enums.ts';
import type { Rationnel } from '../domaine/identifiants.ts';
import defauts from './defauts.json' with { type: 'json' };

/** Phases minutées : les 9 clés de durees_phases_s (DV_RESOLUTION n'a pas de minuteur). */
export type PhaseMinutee = Exclude<Phase, 'DV_RESOLUTION'>;

export interface ConfigJeu {
  readonly joueurs_min: number;
  readonly joueurs_max: number;
  readonly pieces_initiales: number;
  readonly nb_manches: number;
  readonly objectif_par_joueur: number;
  readonly multiplicateur_recompense: number;
  readonly multiplicateur_recompense_tresor_honnetes: number;
  readonly multiplicateur_amende: number;
  readonly cout_enquete: number;
  readonly cout_enquete_inspecteur_tresor: number;
  readonly cout_fausse_accusation: number;
  readonly accusations_max_par_joueur_par_manche: number;
  readonly bonus_mission_reussie: number;
  readonly bonus_marchand_epices_par_voeu_reussi: number;
  readonly taux_interet_pret: Rationnel;
  readonly fraction_retenue_genie: Rationnel;
  readonly fraction_consolation: Rationnel;
  readonly recompense_signature_dernier_voeu: number;
  readonly manche_min_revelation_passe: number;
  readonly parties_requises_pour_debloquer_dernier_voeu: number;
  readonly durees_phases_s: Readonly<Record<PhaseMinutee, number>>;
}

/** Noms des 21 paramètres, dans l'ordre de la SPEC. */
export const PARAMETRES_CONFIGURATION = Object.keys(defauts) as readonly (keyof ConfigJeu)[];

/** Configuration par défaut. Unique origine des valeurs d'équilibrage (RG-60). */
export const CONFIG_DEFAUT = defauts as unknown as ConfigJeu;
