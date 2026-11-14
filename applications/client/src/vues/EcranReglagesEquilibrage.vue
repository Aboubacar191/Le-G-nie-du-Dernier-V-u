<script setup lang="ts">
// ECR-03 — Réglages d'équilibrage de l'hôte (US-17, CA-45).
//
// Un encart d'avertissement PERMANENT accompagne l'écran : ces valeurs sont
// vérifiées par le concepteur du jeu, les modifier change l'équilibre. On
// avertit, on n'empêche pas.
//
// Les paramètres sont découpés en sections de 3 à 5 (Miller), jamais une liste
// unique de 21 champs. Toute valeur se saisit à l'incrémenteur : il n'y a
// aucun clavier numérique dans l'application, pas même ici (RG-78).
//
// L'EFFECTIF (joueurs_min, joueurs_max) est réglable au même titre que le
// reste : sans lui, un playtest à deux marchands exige de réunir cinq
// personnes. La valeur vérifiée du jeu reste celle de defauts.json — l'écran
// en émet une SURCHARGE de session, il ne change aucun défaut. Les deux pas
// sont bornés l'un par l'autre : joueurs_min <= joueurs_max est une contrainte
// croisée du schéma, autant ne pas offrir le geste que le serveur refusera.
//
// Les réglages sont FIGÉS dès que la partie commence : la surcharge voyage dans
// le corps de POST /sessions, et aucune commande ne la modifie ensuite
// (commandes_inexistantes_par_conception).
//
// ÉTATS (DESIGN ECR-03)
// chargement   : lecture de la configuration par défaut, squelette par ligne
//                aux dimensions des incrémenteurs.
// contenu      : sections repliables de 3 à 5 paramètres, chacune portant sa
//                valeur courante et la valeur vérifiée du jeu.
// vide         : non atteignable — la configuration a toujours des défauts.
// erreur       : valeur hors bornes, le pas concerné passe en borne_atteinte ;
//                refus serveur, valeur précédente conservée.
// acces_refuse : non-hôte, ou session déjà démarrée. Chaque cas a sa sortie.

import { onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { bornes, type Bornes } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import { lireConfigurationParDefaut } from '../transport/rest.ts';

/** Les deux paramètres liés par la contrainte croisée joueurs_min <= joueurs_max. */
const CHAMP_EFFECTIF_MIN = 'joueurs_min';
const CHAMP_EFFECTIF_MAX = 'joueurs_max';

/** Sections du contrat de conception : 3 à 5 paramètres chacune (Miller). */
const SECTIONS = [
  { cle: 'ecran.reglages.section_effectif', champs: [CHAMP_EFFECTIF_MIN, CHAMP_EFFECTIF_MAX] },
  { cle: 'ecran.reglages.section_monnaie', champs: ['pieces_initiales', 'objectif_par_joueur', 'nb_manches'] },
  {
    cle: 'ecran.reglages.section_recompenses',
    champs: ['multiplicateur_recompense', 'multiplicateur_recompense_tresor_honnetes'],
  },
  {
    cle: 'ecran.reglages.section_enquetes',
    champs: [
      'cout_enquete',
      'cout_enquete_inspecteur_tresor',
      'multiplicateur_amende',
      'cout_fausse_accusation',
      'accusations_max_par_joueur_par_manche',
    ],
  },
  {
    cle: 'ecran.reglages.section_prets',
    champs: ['bonus_mission_reussie', 'bonus_marchand_epices_par_voeu_reussi'],
  },
  {
    cle: 'ecran.reglages.section_dernier_voeu',
    champs: ['recompense_signature_dernier_voeu', 'parties_requises_pour_debloquer_dernier_voeu'],
  },
] as const;

const PLAFOND_REGLAGE = 100;

const magasin = utiliserMagasin();

const chargement = ref(true);
const erreur = ref(false);
const defauts = ref<Record<string, number>>({});
const valeurs = ref<Record<string, number>>({});
const depliees = ref<Record<string, boolean>>({});
/** Bornes de surcharge PUBLIÉES par GET /configuration/defauts. Jamais devinées. */
const bornesPubliees = ref<Record<string, Bornes>>({});

onMounted(async () => {
  const resultat = await lireConfigurationParDefaut();
  chargement.value = false;
  if (!resultat.ok) {
    erreur.value = true;
    return;
  }
  const config = resultat.valeur.config_par_defaut as unknown as Record<string, unknown>;
  const numeriques: Record<string, number> = {};
  for (const section of SECTIONS) {
    for (const champ of section.champs) {
      const valeur = config[champ];
      if (typeof valeur === 'number') numeriques[champ] = valeur;
    }
  }
  defauts.value = numeriques;
  valeurs.value = { ...numeriques };
  bornesPubliees.value = lireBornes(resultat.valeur.bornes);
});

/** Les bornes du serveur, telles qu'il les publie. Une forme inattendue est ignorée. */
function lireBornes(brutes: Readonly<Record<string, unknown>>): Record<string, Bornes> {
  const lues: Record<string, Bornes> = {};
  for (const [champ, brute] of Object.entries(brutes)) {
    const borne = brute as { min?: unknown; max?: unknown } | null;
    if (typeof borne?.min === 'number' && typeof borne.max === 'number') {
      lues[champ] = bornes(borne.min, borne.max);
    }
  }
  return lues;
}

/**
 * Bornes d'un pas d'incrémenteur. L'effectif est borné par la configuration
 * publiée ET par son pendant : on ne laisse pas saisir joueurs_min > joueurs_max,
 * que le serveur refuserait à la création (RG-71, il revalide de toute façon).
 */
function bornesChamp(champ: string): Bornes {
  const publiee = bornesPubliees.value[champ];
  if (publiee === undefined) return bornes(0, PLAFOND_REGLAGE);
  if (champ === CHAMP_EFFECTIF_MIN) {
    return bornes(publiee.min, valeurs.value[CHAMP_EFFECTIF_MAX] ?? publiee.max);
  }
  if (champ === CHAMP_EFFECTIF_MAX) {
    return bornes(valeurs.value[CHAMP_EFFECTIF_MIN] ?? publiee.min, publiee.max);
  }
  return bornes(0, PLAFOND_REGLAGE);
}

/** Les réglages sont figés dès que la partie commence (étatde session connu). */
const figes = (): boolean => magasin.etat.session !== null;

function retablir(): void {
  valeurs.value = { ...defauts.value };
}

/** Seuls les paramètres ÉCARTÉS de leur valeur vérifiée voyagent (US-17). */
function surchargeRetenue(): Record<string, number> {
  const retenue: Record<string, number> = {};
  for (const [champ, valeur] of Object.entries(valeurs.value)) {
    if (valeur !== defauts.value[champ]) retenue[champ] = valeur;
  }
  return retenue;
}

function appliquer(): void {
  // La surcharge est transmise à la CRÉATION de session (POST /sessions). Il
  // n'existe aucune commande de modification de configuration : le contrat
  // l'exclut explicitement, et l'écran ne peut donc pas en émettre une. Elle
  // est donc MÉMORISÉE jusqu'à ce que ECR-02 crée la session.
  magasin.memoriserSurchargeEquilibrage(surchargeRetenue());
  magasin.preremplirCode('');
  magasin.naviguer('creation');
}
</script>

<template>
  <main class="reglages">
    <EtatVide
      v-if="figes()"
      :titre="texte('ecran.reglages.acces_refuse_demarree')"
      :action-libelle="texte('ecran.reglages.revenir_cercle')"
      @agir="magasin.naviguer('accueil')"
    />

    <template v-else>
      <h1 class="reglages__titre">
        {{ texte('ecran.reglages.titre') }}
      </h1>

      <!-- Encart permanent, variante avertissement. Il informe du coût du
           réglage sans empêcher l'action. -->
      <BandeauAlerte
        variante="avertissement"
        cle-contenu="ecran.reglages.avertissement"
      />

      <BandeauAlerte
        v-if="erreur"
        variante="erreur"
        cle-contenu="code_erreur.ERREUR_INTERNE"
        :action-libelle="texte('commun.reessayer')"
        @reprendre="erreur = false"
      />

      <SqueletteChargement
        v-if="chargement"
        :lignes="SECTIONS.length"
        hauteur="var(--gdv-hauteur-pas-incrementeur)"
        :libelle="texte('commun.chargement')"
      />

      <section
        v-for="section in SECTIONS"
        v-else
        :key="section.cle"
        class="reglages__section"
      >
        <h2 class="reglages__section-titre">
          <button
            type="button"
            class="reglages__deplier"
            :aria-expanded="depliees[section.cle] === true"
            @click="depliees[section.cle] = !depliees[section.cle]"
          >
            {{ texte(section.cle) }}
          </button>
        </h2>

        <div
          v-if="depliees[section.cle]"
          class="reglages__champs"
        >
          <div
            v-for="champ in section.champs"
            :key="champ"
            class="reglages__champ"
          >
            <p class="reglages__libelle">
              {{ texte(`config_libelle.${champ}`) }}
            </p>
            <IncrementeurMontant
              :valeur="valeurs[champ] ?? 0"
              :bornes="bornesChamp(champ)"
              variante="compact"
              :intitule="texte(`config_libelle.${champ}`)"
              @update:valeur="(nouvelle) => (valeurs[champ] = nouvelle)"
            />
            <p class="reglages__verifiee">
              {{ texte('ecran.reglages.valeur_verifiee', { valeur: defauts[champ] ?? 0 }) }}
            </p>
          </div>
        </div>
      </section>

      <div class="reglages__actions">
        <BoutonAction
          :libelle="texte('ecran.reglages.retablir')"
          variante="secondaire"
          taille="md"
          @agir="retablir"
        />
        <BoutonAction
          :libelle="texte('ecran.reglages.appliquer')"
          variante="principal"
          taille="md"
          @agir="appliquer"
        />
        <BoutonAction
          :libelle="texte('commun.annuler')"
          variante="discret"
          taille="md"
          @agir="magasin.naviguer('accueil')"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.reglages {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.reglages__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.reglages__section {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
}

.reglages__section-titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.reglages__deplier {
  inline-size: 100%;
  min-block-size: var(--gdv-cible-minimale);
  border: none;
  background: none;
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-titre-section);
  text-align: start;
  cursor: pointer;
}

.reglages__deplier:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.reglages__champs {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.reglages__champ {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.reglages__libelle {
  margin: 0;
  font-size: var(--gdv-role-corps);
}

.reglages__verifiee {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.reglages__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-12);
  margin-block-start: auto;
}
</style>
