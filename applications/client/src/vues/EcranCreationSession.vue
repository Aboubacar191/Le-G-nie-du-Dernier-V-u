<script setup lang="ts">
// ECR-02 — Création de session. Nommer l'hôte et créer la session. Les réglages
// d'équilibrage sont volontairement REPLIÉS : deux contacts suffisent à créer
// une partie, les valeurs vérifiées du jeu font le reste.
//
// jeton_session et jeton_groupe sont émis une seule fois ici, stockés
// localement, et JAMAIS affichés (ADR-TL-15).
//
// ÉTATS (DESIGN ECR-02)
// chargement   : après Créer, bouton en chargement et champ désactivé. Aucun
//                écran blanc intermédiaire.
// contenu      : un champ pseudo à libellé persistant, le nombre de manches,
//                un résumé des valeurs vérifiées, une bascule de mode avancé
//                avec sa raison si indisponible, un lien vers les réglages
//                complets, un bouton principal.
// vide         : non atteignable — c'est un formulaire, il n'a rien à charger.
// erreur       : pseudo vide ou déjà pris, message SOUS le champ ; échec de
//                création, bandeau avec reprise et pseudo CONSERVÉ.
// acces_refuse : non atteignable.
//
// ÉCRAN D DU PROTOTYPE — reproduction complète, les deux sélecteurs
// RÉELLEMENT câblés sur la surcharge d'équilibrage (US-17), même mécanisme
// que ECR-03, sans écraser ce que l'hôte y aurait déjà réglé (fusion, pas
// remplacement) :
//  · « Nombre de manches » (3/5/7) → nb_manches ;
//  · « Temps de négociation » (1:30/2:00/3:00) → durees_phases_s.NEGOCIATION,
//    SEUL paramètre imbriqué du contrat (SchemaSurchargeConfig accepte déjà
//    durees_phases_s en partiel — vérifié par un appel réel au serveur avant
//    d'écrire ce code, aucune extension de contrat n'a été nécessaire).
// Les lignes « Pièces de départ » et « Joueurs » affichent les valeurs
// RÉELLES publiées par GET /configuration/defauts, en lecture seule — rien
// côté serveur ne permet de les régler par session.
//
// La « durée estimée » n'est affichée nulle part par le serveur. Calculée ici
// à partir des VRAIES durées de phase CHOISIES (VOEU + NEGOCIATION +
// DECLARATION_PAIEMENT + REVELATION + ENQUETES_ACCUSATIONS + EXECUTION) ×
// manches choisies, plus les trois phases du Dernier Vœu si le mode est actif
// — jamais un chiffre inventé, mais une MINORATION : elle ne compte ni la
// mise en place, ni les débats qui débordent leur minuteur.

import { computed, onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BasculeReglage from '../composants/BasculeReglage.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import ChampTexteCourt from '../composants/ChampTexteCourt.vue';
import CreationResume from '../composants/CreationResume.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin, utiliserStockage } from '../magasin/injection.ts';
import { ecrireJetonGroupe, relireJetonGroupe } from '../transport/stockage-jeton.ts';
import {
  creerSession,
  lireConfigurationParDefaut,
  lireGroupeCourant,
  type ConfigJeuPublique,
} from '../transport/rest.ts';

const LONGUEUR_MAX_PSEUDO = 12;
/** Choix fixes du prototype (écran D). Filtrés aux bornes réelles au montage. */
const CANDIDATS_MANCHES = [3, 5, 7];
/** 1:30 / 2:00 / 3:00, en secondes — mêmes trois choix que le prototype. */
const CANDIDATS_NEGOCIATION = [90, 120, 180];
/** Phases d'une manche normale, dans l'ordre du pipeline (étapes 1 à 17).
 * NEGOCIATION est substituée par la valeur CHOISIE, pas la valeur publiée. */
const PHASES_MANCHE_HORS_NEGOCIATION = [
  'VOEU', 'DECLARATION_PAIEMENT', 'REVELATION', 'ENQUETES_ACCUSATIONS', 'EXECUTION',
];
const PHASES_DERNIER_VOEU = ['DV_PROPOSITION', 'DV_DEBAT', 'DV_SIGNATURE'];

const magasin = utiliserMagasin();
const stockage = utiliserStockage();

// Repris de ECR-01 · Bienvenue, sans le reressaisir (RG inexistante encore,
// simple confort : la capture d'origine reste sur Bienvenue, modifiable ici).
const pseudo = ref(magasin.pseudoPrerempli());
const modeAvance = ref(false);
const chargement = ref(false);
const erreurChamp = ref('');
const erreurGlobale = ref('');
const partiesTerminees = ref(0);
const partiesRequises = ref(0);

const deblocageAcquis = computed(() => partiesTerminees.value >= partiesRequises.value);

const defauts = ref<ConfigJeuPublique | null>(null);
const bornesManches = ref<{ min: number; max: number } | null>(null);
const bornesDurees = ref<{ min: number; max: number } | null>(null);
const manchesChoisies = ref(0);
const negociationChoisieS = ref(0);

const candidatsManchesAffiches = computed(() => {
  const bornes = bornesManches.value;
  if (bornes === null) return CANDIDATS_MANCHES;
  return CANDIDATS_MANCHES.filter((n) => n >= bornes.min && n <= bornes.max);
});

const candidatsNegociationAffiches = computed(() => {
  const bornes = bornesDurees.value;
  if (bornes === null) return CANDIDATS_NEGOCIATION;
  return CANDIDATS_NEGOCIATION.filter((n) => n >= bornes.min && n <= bornes.max);
});

/** Somme de durées de phase réelles (0 si une clé manque, jamais devinée). */
function sommeDurees(cles: readonly string[]): number {
  const table = defauts.value?.durees_phases_s ?? {};
  return cles.reduce((total, cle) => total + (table[cle] ?? 0), 0);
}

const dureeEstimeeMin = computed(() => {
  if (defauts.value === null || manchesChoisies.value === 0) return null;
  const negociation = negociationChoisieS.value || defauts.value.durees_phases_s.NEGOCIATION || 0;
  let secondes = (sommeDurees(PHASES_MANCHE_HORS_NEGOCIATION) + negociation) * manchesChoisies.value;
  if (modeAvance.value && deblocageAcquis.value) secondes += sommeDurees(PHASES_DERNIER_VOEU);
  return Math.ceil(secondes / 60);
});

/** Même règle que ECR-03 (US-17) : seul un écart à la valeur vérifiée voyage. */
function choisirManches(n: number): void {
  manchesChoisies.value = n;
  const existante = { ...(magasin.surchargeEquilibrage() ?? {}) };
  if (defauts.value !== null && n !== defauts.value.nb_manches) existante.nb_manches = n;
  else delete existante.nb_manches;
  magasin.memoriserSurchargeEquilibrage(existante);
}

/** Même règle, mais sur le SEUL paramètre imbriqué (durees_phases_s.NEGOCIATION). */
function choisirNegociation(secondes: number): void {
  negociationChoisieS.value = secondes;
  const existante = { ...(magasin.surchargeEquilibrage() ?? {}) };
  if (defauts.value !== null && secondes !== defauts.value.durees_phases_s.NEGOCIATION) {
    existante.durees_phases_s = { NEGOCIATION: secondes };
  } else {
    delete existante.durees_phases_s;
  }
  magasin.memoriserSurchargeEquilibrage(existante);
}

async function chargerProgressionGroupe(): Promise<void> {
  const jetonGroupe = relireJetonGroupe(stockage);
  if (jetonGroupe === null) return;
  const groupe = await lireGroupeCourant(jetonGroupe);
  if (!groupe.ok) return;
  partiesTerminees.value = groupe.valeur.parties_terminees;
  partiesRequises.value = groupe.valeur.parties_requises;
}

function lireBorne(brute: unknown): { min: number; max: number } | null {
  const borne = brute as { min?: unknown; max?: unknown } | undefined;
  if (typeof borne?.min === 'number' && typeof borne.max === 'number') {
    return { min: borne.min, max: borne.max };
  }
  return null;
}

/** La surcharge déjà mémorisée (ex. depuis ECR-03) prime sur la valeur vérifiée. */
function initialiserChoixDepuisSurcharge(config: ConfigJeuPublique): void {
  const surcharge = magasin.surchargeEquilibrage();

  const manchesSurchargees = surcharge?.nb_manches;
  manchesChoisies.value = typeof manchesSurchargees === 'number'
    ? manchesSurchargees
    : config.nb_manches;

  const dureesSurchargees = surcharge?.durees_phases_s;
  const negociationSurchargee = typeof dureesSurchargees === 'object' && dureesSurchargees !== null
    ? dureesSurchargees.NEGOCIATION
    : undefined;
  negociationChoisieS.value = typeof negociationSurchargee === 'number'
    ? negociationSurchargee
    : (config.durees_phases_s.NEGOCIATION ?? 0);
}

onMounted(async () => {
  await chargerProgressionGroupe();

  const config = await lireConfigurationParDefaut();
  if (!config.ok) return;
  defauts.value = config.valeur.config_par_defaut;
  bornesManches.value = lireBorne(config.valeur.bornes.nb_manches);
  bornesDurees.value = lireBorne(config.valeur.bornes.durees_phases_s);
  initialiserChoixDepuisSurcharge(config.valeur.config_par_defaut);
});

async function creer(): Promise<void> {
  erreurChamp.value = '';
  erreurGlobale.value = '';
  if (pseudo.value.trim() === '') {
    erreurChamp.value = texte('code_erreur.PSEUDO_INDISPONIBLE');
    return;
  }
  chargement.value = true;
  const resultat = await creerSession({
    pseudo: pseudo.value.trim(),
    jeton_groupe: relireJetonGroupe(stockage),
    // La surcharge réglée sur ECR-03 ne voyage QU'ICI : la configuration est
    // figée à la création, aucune commande ne la modifie ensuite (US-17).
    config_surchargee: magasin.surchargeEquilibrage(),
    activer_mode_avance: modeAvance.value,
  });
  chargement.value = false;

  if (!resultat.ok) {
    // Le pseudo est CONSERVÉ : le reperdre après un refus serveur ferait
    // ressaisir au joueur ce qu'il venait d'écrire.
    const cible = resultat.code === 'PSEUDO_INDISPONIBLE' ? erreurChamp : erreurGlobale;
    cible.value = texte(`code_erreur.${resultat.code}`, { pseudo: pseudo.value });
    return;
  }

  ecrireJetonGroupe(stockage, resultat.valeur.jeton_groupe);
  magasin.ouvrirSession({
    session_id: resultat.valeur.session_id,
    jeton_session: resultat.valeur.jeton_session,
    joueur_id: resultat.valeur.joueur_id,
    est_hote: true,
    url_temps_reel: resultat.valeur.url_temps_reel,
  });
  magasin.preremplirCode(resultat.valeur.code_adhesion);
  magasin.naviguer('invitation');
}
</script>

<template>
  <main class="creation">
    <h1 class="creation__titre">
      {{ texte('ecran.creation.titre') }}
    </h1>

    <BandeauAlerte
      v-if="erreurGlobale"
      variante="erreur"
      cle-contenu="ecran.creation.echec"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="erreurGlobale = ''"
    />

    <ChampTexteCourt
      v-model:valeur="pseudo"
      variante="pseudo"
      :libelle="texte('ecran.creation.libelle_pseudo')"
      :aide="texte('ecran.creation.aide_pseudo')"
      :erreur="erreurChamp"
      :desactive="chargement"
      :longueur-max="LONGUEUR_MAX_PSEUDO"
    />

    <CreationResume
      :candidats-manches="candidatsManchesAffiches"
      :manches-choisies="manchesChoisies"
      :candidats-negociation="candidatsNegociationAffiches"
      :negociation-choisie-s="negociationChoisieS"
      :defauts="defauts"
      :duree-estimee-min="dureeEstimeeMin"
      @choisir-manches="choisirManches"
      @choisir-negociation="choisirNegociation"
    />

    <BasculeReglage
      v-model:actif="modeAvance"
      :libelle="texte('ecran.creation.mode_avance')"
      :mot-actif="texte('ecran.salle_attente.mode_avance_actif')"
      :mot-inactif="texte('ecran.salle_attente.mode_avance_inactif')"
      :desactive="!deblocageAcquis"
      :raison="texte('ecran.creation.mode_avance_verrouille', { requises: partiesRequises })"
    />

    <BoutonAction
      :libelle="texte('ecran.creation.regler_equilibrage')"
      variante="discret"
      taille="md"
      @agir="magasin.naviguer('reglages')"
    />

    <BoutonAction
      :libelle="texte('ecran.creation.creer')"
      variante="principal"
      taille="lg"
      pleine-largeur
      :chargement="chargement"
      @agir="creer"
    />
  </main>
</template>

<style scoped>
.creation {
  display: flex;
  flex-direction: column;
  /* Écart entre deux champs : espacement.16 au minimum. */
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.creation__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

</style>
