// =============================================================================
// CONFIGURATION DE JEU — RG-60 / CA-45 / CA-46
// =============================================================================
// « TOUTES les valeurs de parametres_configuration vivent dans defauts.json.
//   Aucune n'apparaît en littéral dans le code du moteur. »
//
// Ce fichier porte le TYPE, les BORNES de surcharge et la FUSION. Il ne porte
// aucune valeur de règle : les 21 valeurs sont dans defauts.json, et nulle part
// ailleurs (tests/configuration-defauts.test.ts le vérifie contre la SPEC).
//
// Les minima et maxima sont LUS dans API-GDV-001.json / ConfigJeuPublique quand
// le contrat les porte. Quand il n'y porte pas de maximum — la borne réelle
// étant le jeu lui-même — un PLAFOND DE SURCHARGE est déclaré ici avec son
// motif : la prescription de migration Zod impose que tout entier entrant soit
// borné en haut comme en bas, et une surcharge d'hôte non bornée est une
// surface d'épuisement avant même d'être une absurdité de jeu.

import { z } from 'zod';

import { schemaContrat } from '../contrat/lecture.ts';
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

// --- Plafonds de surcharge, déclarés avec leur motif -------------------------
const PLAFOND_MONTANT = 999;
const PLAFOND_MULTIPLICATEUR = 10;
const PLAFOND_DUREE_PHASE_S = 3600;
const PLAFOND_TERME_RATIONNEL = 100;
const PLAFOND_MANCHES = 20;
const PLAFOND_PARTIES_REQUISES = 100;

const PROPRIETES_CONTRAT = schemaContrat('ConfigJeuPublique').properties ?? {};
const PROPRIETES_DUREES = schemaContrat('ConfigJeuPublique').properties?.durees_phases_s
  ?.properties ?? {};

export interface BorneParametre {
  readonly min: number;
  readonly max: number;
  readonly type: 'entier' | 'rationnel' | 'objet';
}

function borneEntier(cle: string, defautMin: number, plafond: number): BorneParametre {
  const propriete = PROPRIETES_CONTRAT[cle];
  return {
    min: typeof propriete?.minimum === 'number' ? propriete.minimum : defautMin,
    max: typeof propriete?.maximum === 'number' ? propriete.maximum : plafond,
    type: 'entier',
  };
}

const BORNE_RATIONNEL: BorneParametre = { min: 1, max: PLAFOND_TERME_RATIONNEL, type: 'rationnel' };

/**
 * Bornes publiées par GET /configuration/defauts. Le client s'en sert pour
 * refuser une saisie absurde ; le serveur revalide systématiquement (RG-71).
 */
export const BORNES_CONFIGURATION: Readonly<Record<keyof ConfigJeu, BorneParametre>> = {
  joueurs_min: borneEntier('joueurs_min', 2, PLAFOND_MULTIPLICATEUR),
  joueurs_max: borneEntier('joueurs_max', 2, PLAFOND_MULTIPLICATEUR),
  pieces_initiales: borneEntier('pieces_initiales', 0, PLAFOND_MONTANT),
  nb_manches: borneEntier('nb_manches', 1, PLAFOND_MANCHES),
  objectif_par_joueur: borneEntier('objectif_par_joueur', 0, PLAFOND_MONTANT),
  multiplicateur_recompense: borneEntier('multiplicateur_recompense', 1, PLAFOND_MULTIPLICATEUR),
  multiplicateur_recompense_tresor_honnetes: borneEntier(
    'multiplicateur_recompense_tresor_honnetes',
    1,
    PLAFOND_MULTIPLICATEUR,
  ),
  multiplicateur_amende: borneEntier('multiplicateur_amende', 0, PLAFOND_MULTIPLICATEUR),
  cout_enquete: borneEntier('cout_enquete', 0, PLAFOND_MONTANT),
  cout_enquete_inspecteur_tresor: borneEntier('cout_enquete_inspecteur_tresor', 0, PLAFOND_MONTANT),
  cout_fausse_accusation: borneEntier('cout_fausse_accusation', 0, PLAFOND_MONTANT),
  accusations_max_par_joueur_par_manche: borneEntier(
    'accusations_max_par_joueur_par_manche',
    0,
    PLAFOND_MULTIPLICATEUR,
  ),
  bonus_mission_reussie: borneEntier('bonus_mission_reussie', 0, PLAFOND_MONTANT),
  bonus_marchand_epices_par_voeu_reussi: borneEntier(
    'bonus_marchand_epices_par_voeu_reussi',
    0,
    PLAFOND_MONTANT,
  ),
  taux_interet_pret: BORNE_RATIONNEL,
  fraction_retenue_genie: BORNE_RATIONNEL,
  fraction_consolation: BORNE_RATIONNEL,
  recompense_signature_dernier_voeu: borneEntier(
    'recompense_signature_dernier_voeu',
    0,
    PLAFOND_MONTANT,
  ),
  manche_min_revelation_passe: borneEntier('manche_min_revelation_passe', 1, PLAFOND_MANCHES),
  parties_requises_pour_debloquer_dernier_voeu: borneEntier(
    'parties_requises_pour_debloquer_dernier_voeu',
    0,
    PLAFOND_PARTIES_REQUISES,
  ),
  durees_phases_s: { min: 1, max: PLAFOND_DUREE_PHASE_S, type: 'objet' },
};

// --- Schéma Zod strict -------------------------------------------------------
function entier(cle: keyof ConfigJeu): z.ZodType<number> {
  const borne = BORNES_CONFIGURATION[cle];
  return z.number().int().min(borne.min).max(borne.max);
}

const rationnel = (): z.ZodType<[number, number]> =>
  z.tuple([
    z.number().int().min(0).max(PLAFOND_TERME_RATIONNEL),
    z.number().int().min(1).max(PLAFOND_TERME_RATIONNEL),
  ]);

const dureePhase = (): z.ZodType<number> =>
  z
    .number()
    .int()
    .min(BORNES_CONFIGURATION.durees_phases_s.min)
    .max(BORNES_CONFIGURATION.durees_phases_s.max);

const CLES_DUREES = Object.keys(PROPRIETES_DUREES) as readonly PhaseMinutee[];

const SCHEMA_DUREES = z.strictObject(
  Object.fromEntries(CLES_DUREES.map((cle) => [cle, dureePhase()])) as Record<
    PhaseMinutee,
    z.ZodType<number>
  >,
);

export const SchemaConfigJeu = z
  .strictObject({
    joueurs_min: entier('joueurs_min'),
    joueurs_max: entier('joueurs_max'),
    pieces_initiales: entier('pieces_initiales'),
    nb_manches: entier('nb_manches'),
    objectif_par_joueur: entier('objectif_par_joueur'),
    multiplicateur_recompense: entier('multiplicateur_recompense'),
    multiplicateur_recompense_tresor_honnetes: entier('multiplicateur_recompense_tresor_honnetes'),
    multiplicateur_amende: entier('multiplicateur_amende'),
    cout_enquete: entier('cout_enquete'),
    cout_enquete_inspecteur_tresor: entier('cout_enquete_inspecteur_tresor'),
    cout_fausse_accusation: entier('cout_fausse_accusation'),
    accusations_max_par_joueur_par_manche: entier('accusations_max_par_joueur_par_manche'),
    bonus_mission_reussie: entier('bonus_mission_reussie'),
    bonus_marchand_epices_par_voeu_reussi: entier('bonus_marchand_epices_par_voeu_reussi'),
    taux_interet_pret: rationnel(),
    fraction_retenue_genie: rationnel(),
    fraction_consolation: rationnel(),
    recompense_signature_dernier_voeu: entier('recompense_signature_dernier_voeu'),
    manche_min_revelation_passe: entier('manche_min_revelation_passe'),
    parties_requises_pour_debloquer_dernier_voeu: entier(
      'parties_requises_pour_debloquer_dernier_voeu',
    ),
    durees_phases_s: SCHEMA_DUREES,
  })
  .refine((config) => config.joueurs_min <= config.joueurs_max, {
    message: 'joueurs_min doit rester inférieur ou égal à joueurs_max',
  });

/** Surcharge de l'hôte : sous-ensemble STRICT de la configuration (US-17). */
export const SchemaSurchargeConfig = z
  .strictObject({
    joueurs_min: entier('joueurs_min').optional(),
    joueurs_max: entier('joueurs_max').optional(),
    pieces_initiales: entier('pieces_initiales').optional(),
    nb_manches: entier('nb_manches').optional(),
    objectif_par_joueur: entier('objectif_par_joueur').optional(),
    multiplicateur_recompense: entier('multiplicateur_recompense').optional(),
    multiplicateur_recompense_tresor_honnetes: entier(
      'multiplicateur_recompense_tresor_honnetes',
    ).optional(),
    multiplicateur_amende: entier('multiplicateur_amende').optional(),
    cout_enquete: entier('cout_enquete').optional(),
    cout_enquete_inspecteur_tresor: entier('cout_enquete_inspecteur_tresor').optional(),
    cout_fausse_accusation: entier('cout_fausse_accusation').optional(),
    accusations_max_par_joueur_par_manche: entier(
      'accusations_max_par_joueur_par_manche',
    ).optional(),
    bonus_mission_reussie: entier('bonus_mission_reussie').optional(),
    bonus_marchand_epices_par_voeu_reussi: entier(
      'bonus_marchand_epices_par_voeu_reussi',
    ).optional(),
    taux_interet_pret: rationnel().optional(),
    fraction_retenue_genie: rationnel().optional(),
    fraction_consolation: rationnel().optional(),
    recompense_signature_dernier_voeu: entier('recompense_signature_dernier_voeu').optional(),
    manche_min_revelation_passe: entier('manche_min_revelation_passe').optional(),
    parties_requises_pour_debloquer_dernier_voeu: entier(
      'parties_requises_pour_debloquer_dernier_voeu',
    ).optional(),
    durees_phases_s: SCHEMA_DUREES.partial().optional(),
  })
  .optional();

export type SurchargeConfig = z.infer<typeof SchemaSurchargeConfig>;

export type ResultatFusion =
  | { readonly ok: true; readonly config: ConfigJeu }
  | { readonly ok: false; readonly erreurs: Readonly<Record<string, readonly string[]>> };

/**
 * Fusionne les défauts avec la surcharge de l'hôte, puis REVALIDE l'ensemble.
 * La configuration effective est figée à la création de session : une partie ne
 * change pas de règles en cours de route, et le rejeu reste exact.
 */
export function fusionnerConfig(surcharge: unknown): ResultatFusion {
  const valide = SchemaSurchargeConfig.safeParse(surcharge ?? undefined);
  if (!valide.success) return { ok: false, erreurs: regrouper(valide.error) };

  const partielle = valide.data ?? {};
  const fusion = {
    ...CONFIG_DEFAUT,
    ...partielle,
    durees_phases_s: { ...CONFIG_DEFAUT.durees_phases_s, ...(partielle.durees_phases_s ?? {}) },
  };

  const complete = SchemaConfigJeu.safeParse(fusion);
  if (!complete.success) return { ok: false, erreurs: regrouper(complete.error) };
  return { ok: true, config: complete.data as unknown as ConfigJeu };
}

function regrouper(erreur: z.ZodError): Readonly<Record<string, readonly string[]>> {
  const groupes: Record<string, string[]> = {};
  for (const probleme of erreur.issues) {
    const cle = probleme.path.length === 0 ? 'config_surchargee' : probleme.path.join('.');
    (groupes[cle] ??= []).push(probleme.message);
  }
  return groupes;
}
