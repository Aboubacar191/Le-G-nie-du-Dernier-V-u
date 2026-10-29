<script setup lang="ts">
// UNIQUE moyen de saisir un nombre dans l'application — RG-78.
//
// input[type=number], input[type=text] et tout clavier logiciel sont INTERDITS
// pour un montant. Deux raisons, et aucune n'est esthétique : ouvrir un clavier
// consomme la moitié d'une fenêtre de 30 s pour deux actes simultanés sur toute
// la table, et il affiche la valeur en grand au centre de l'écran, donc au
// voisin assis à côté.
//
// Ce composant n'émet AUCUN élément de saisie. La valeur est un texte, et les
// deux pas sont des boutons de 64 px ancrés dans le tiers bas, atteignables au
// pouce sans repositionner la main (Fitts). Les raccourcis ramènent la tâche
// courante à deux contacts : un jeton, puis valider.
//
// Clavier, pour que rien n'exige un pointeur : Flèches ±1, Page ±5, Début et
// Fin aux bornes.
//
// Les bornes sont FOURNIES par l'appelant (solde pour RG-08, montant déclaré
// pour RG-09). Aucune règle de jeu n'est calculée ici, et l'autorité du refus
// reste au serveur, qui revérifie tout.

import { computed, onBeforeUnmount, ref } from 'vue';

import { texte } from '../logique/contenu.ts';
import {
  borneBasseAtteinte,
  borneHauteAtteinte,
  borner,
  decrementer,
  incrementer,
  PAS_RAPIDE,
  type Bornes,
  type Raccourci,
} from '../logique/montant.ts';

export type VarianteIncrementeur = 'public' | 'secret' | 'compact';

interface Props {
  valeur: number;
  bornes: Bornes;
  variante?: VarianteIncrementeur;
  raccourcis?: readonly Raccourci[];
  desactive?: boolean;
  chargement?: boolean;
  erreur?: boolean;
  /** Nom accessible du groupe. */
  intitule: string;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'public',
  raccourcis: () => [],
  desactive: false,
  chargement: false,
  erreur: false,
});

const emettre = defineEmits<{ 'update:valeur': [valeur: number] }>();

const MS_REPETITION_LENTE = 150;
const MS_REPETITION_RAPIDE = 60;
const SEUIL_ACCELERATION = 10;

const repetition = ref<ReturnType<typeof setInterval> | null>(null);
let coups = 0;

const inerte = computed(() => props.desactive || props.chargement);

function poser(valeur: number): void {
  emettre('update:valeur', borner(valeur, props.bornes));
}

function arreterRepetition(): void {
  if (repetition.value !== null) clearInterval(repetition.value);
  repetition.value = null;
  coups = 0;
}

onBeforeUnmount(arreterRepetition);

function pas(sens: 1 | -1, quantite = 1): void {
  if (inerte.value) return;
  poser(sens === 1
    ? incrementer(props.valeur, props.bornes, quantite)
    : decrementer(props.valeur, props.bornes, quantite));
}

/** Maintien d'un pas : répétition accélérée. Le nombre change, rien d'autre. */
function commencerRepetition(sens: 1 | -1): void {
  if (inerte.value) return;
  pas(sens);
  arreterRepetition();
  repetition.value = setInterval(() => {
    coups += 1;
    pas(sens);
    if (coups === SEUIL_ACCELERATION) {
      clearInterval(repetition.value as ReturnType<typeof setInterval>);
      repetition.value = setInterval(() => pas(sens), MS_REPETITION_RAPIDE);
    }
  }, MS_REPETITION_LENTE);
}

const messageBorne = computed((): string => {
  if (!borneHauteAtteinte(props.valeur, props.bornes)) return '';
  return props.variante === 'secret'
    ? texte('incrementeur.borne_haute_secret')
    : texte('incrementeur.borne_haute_public');
});
</script>

<template>
  <div
    class="incrementeur"
    :class="[`incrementeur--${props.variante}`, { 'incrementeur--erreur': props.erreur }]"
    role="group"
    :aria-label="props.intitule"
  >
    <div class="incrementeur__rangee">
      <button
        type="button"
        class="incrementeur__pas"
        :disabled="inerte || borneBasseAtteinte(props.valeur, props.bornes)"
        :aria-label="texte('incrementeur.moins')"
        @pointerdown="commencerRepetition(-1)"
        @pointerup="arreterRepetition"
        @pointerleave="arreterRepetition"
      >
        −
      </button>

      <!-- La valeur est un TEXTE, pas un champ : aucun clavier ne peut s'ouvrir.
           role=spinbutton donne la sémantique de saisie sans l'élément. -->
      <p
        class="incrementeur__valeur"
        role="spinbutton"
        tabindex="0"
        :aria-valuenow="props.valeur"
        :aria-valuemin="props.bornes.min"
        :aria-valuemax="props.bornes.max"
        :aria-live="props.variante === 'secret' ? 'off' : 'polite'"
        @keydown.up.prevent="pas(1)"
        @keydown.down.prevent="pas(-1)"
        @keydown.page-up.prevent="pas(1, PAS_RAPIDE)"
        @keydown.page-down.prevent="pas(-1, PAS_RAPIDE)"
        @keydown.home.prevent="poser(props.bornes.min)"
        @keydown.end.prevent="poser(props.bornes.max)"
      >
        {{ props.valeur }}
      </p>

      <button
        type="button"
        class="incrementeur__pas"
        :disabled="inerte || borneHauteAtteinte(props.valeur, props.bornes)"
        :aria-label="texte('incrementeur.plus')"
        @pointerdown="commencerRepetition(1)"
        @pointerup="arreterRepetition"
        @pointerleave="arreterRepetition"
      >
        +
      </button>
    </div>

    <ul
      v-if="props.raccourcis.length > 0"
      class="incrementeur__raccourcis"
    >
      <li
        v-for="raccourci in props.raccourcis"
        :key="raccourci.cle_contenu"
      >
        <button
          type="button"
          class="incrementeur__jeton"
          :disabled="inerte"
          @click="poser(raccourci.valeur)"
        >
          {{ texte(raccourci.cle_contenu) }}
        </button>
      </li>
    </ul>

    <p
      v-if="messageBorne"
      class="incrementeur__message"
    >
      {{ messageBorne }}
    </p>
  </div>
</template>

<style scoped>
.incrementeur {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  inline-size: 100%;
}

.incrementeur__rangee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.incrementeur__pas {
  flex: none;
  inline-size: var(--gdv-largeur-pas-incrementeur);
  block-size: var(--gdv-hauteur-pas-incrementeur);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-nombre-secondaire);
  cursor: pointer;
  touch-action: none;
  transition: background var(--gdv-duree-rapide) var(--gdv-courbe-standard);
}

.incrementeur__pas:hover {
  background: var(--gdv-surface-desactivee);
}

.incrementeur__pas:active {
  background: var(--gdv-accent-action-actif);
  color: var(--gdv-texte-sur-accent);
}

.incrementeur__pas:focus-visible,
.incrementeur__valeur:focus-visible,
.incrementeur__jeton:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.incrementeur__pas:disabled {
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
  cursor: not-allowed;
}

.incrementeur__valeur {
  flex: 1 1 auto;
  margin: 0;
  text-align: center;
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
  line-height: var(--gdv-interligne-titre);
}

.incrementeur--secret .incrementeur__valeur {
  color: var(--gdv-texte-sur-voile);
}

.incrementeur__raccourcis {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.incrementeur__jeton {
  min-block-size: var(--gdv-cible-minimale);
  padding-inline: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-etiquette);
  cursor: pointer;
}

.incrementeur--secret .incrementeur__jeton {
  background: transparent;
  border-color: var(--gdv-bordure-secret);
  color: var(--gdv-texte-sur-voile);
}

.incrementeur__message {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.incrementeur--secret .incrementeur__message {
  color: var(--gdv-texte-sur-voile);
}

.incrementeur--erreur {
  padding: var(--gdv-espacement-8);
  border: var(--gdv-trait-moyen) solid var(--gdv-statut-echec);
  border-radius: var(--gdv-rayon-moyen);
}
</style>
