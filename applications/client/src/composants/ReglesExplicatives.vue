<script setup lang="ts">
// Règles en 3 étapes — reproduit reference-prototype/
// f-regles-en-3-etapes.ecran.html (relu après sa mise à jour F1/F2/F3). Hors
// des 32 écrans du contrat, état local à AccueilMenu.vue, pas un ECR de plus.
//
// Chiffres d'exemple (annonce 4, paye 1) : cadre déjà choisi par le moteur
// pour sa preuve de la matrice de gains du GDD, pas une valeur inventée ici.
// Étape 1 : « Passer » (pas « Précédent » désactivé) — rien avant la
// première étape, donc sortir du tutoriel, même geste que la croix.
// Étape 3 : rôle et mission d'exemple (Inspecteur du Trésor, Le Justicier)
// sont des NOMS RÉELS du contrat, choisis comme illustration neutre.

import { computed, ref } from 'vue';

import BoutonAction from './BoutonAction.vue';
import RegleContenuEtape from './RegleContenuEtape.vue';
import { texte } from '../logique/contenu.ts';

const emettre = defineEmits<{ fermer: [] }>();

const DERNIERE_ETAPE = 2;
const etape = ref(0);

const estPremiere = computed(() => etape.value === 0);
const estDerniere = computed(() => etape.value === DERNIERE_ETAPE);

function precedent(): void {
  etape.value = Math.max(0, etape.value - 1);
}
function suivant(): void {
  etape.value = Math.min(DERNIERE_ETAPE, etape.value + 1);
}
/** Bouton gauche : « Passer » ferme tout sur l'étape 1, « Précédent » recule ensuite. */
function agirBoutonGauche(): void {
  if (estPremiere.value) emettre('fermer');
  else precedent();
}
</script>

<template>
  <section class="regles">
    <header class="regles__entete">
      <button
        type="button"
        class="regles__fermer"
        :aria-label="texte('ecran.regles.fermer')"
        @click="emettre('fermer')"
      >
        <svg
          viewBox="0 0 18 18"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 4l10 10M14 4L4 14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <span class="regles__compte">
        {{ texte('ecran.regles.etape_compte', { num: etape + 1 }) }}
      </span>
    </header>

    <div
      class="regles__pastilles"
      aria-hidden="true"
    >
      <span
        v-for="n in 3"
        :key="n"
        class="regles__pastille"
        :class="{ 'regles__pastille--active': n - 1 <= etape }"
      />
    </div>

    <RegleContenuEtape :etape="etape" />

    <div class="regles__nav">
      <BoutonAction
        :libelle="texte(estPremiere ? 'ecran.regles.passer' : 'ecran.regles.precedent')"
        variante="secondaire"
        taille="lg"
        @agir="agirBoutonGauche"
      />
      <BoutonAction
        v-if="!estDerniere"
        :libelle="texte('ecran.regles.suivant')"
        variante="principal"
        taille="lg"
        @agir="suivant"
      />
      <BoutonAction
        v-else
        :libelle="texte('ecran.regles.compris')"
        variante="principal"
        taille="lg"
        @agir="emettre('fermer')"
      />
    </div>
  </section>
</template>

<style scoped>
.regles {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.regles__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.regles__fermer {
  display: grid;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-principal);
  cursor: pointer;
}

.regles__fermer svg {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
}

.regles__fermer:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.regles__compte {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.regles__pastilles {
  display: flex;
  gap: var(--gdv-espacement-8);
}

.regles__pastille {
  flex: 1 1 auto;
  block-size: var(--gdv-trait-epais);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-bordure-champ);
}

.regles__pastille--active {
  background: var(--gdv-accent-action);
}

.regles__nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--gdv-espacement-8);
  margin-block-start: auto;
}
</style>
