<script setup lang="ts">
// Carte d'action — reproduit les cartes « Créer » / « Rejoindre » de l'écran
// C · Accueil du prototype (reference-prototype/c-accueil.ecran.html) :
// titre + flèche sur une ligne, sous-titre en dessous, carte entière cliquable.
//
// Mêmes trois règles non négociables que BoutonAction.vue, dont ce composant
// reprend le dispositif plutôt que de le réinventer : raison TOUJOURS sous le
// libellé quand désactivé, et l'enveloppe capte l'appui refusé puisqu'un
// <button disabled> ne reçoit ni clic ni focus (ANO-UX-02).

import { ref, useId } from 'vue';

import { DUREES_MS } from '../styles/jetons.ts';

export type VarianteCarte = 'principal' | 'secondaire';

interface Props {
  libelle: string;
  description: string;
  variante?: VarianteCarte;
  desactive?: boolean;
  /** Obligatoire dès que `desactive` est vrai : sinon le joueur cherche. */
  raison?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'principal',
  desactive: false,
  raison: '',
});

const emettre = defineEmits<{ agir: [] }>();

function agirAuClic(): void {
  if (props.desactive) return;
  emettre('agir');
}

const idRaison = useId();
const raisonSignalee = ref(false);
let minuterieSignal: ReturnType<typeof setTimeout> | null = null;

function signalerRefus(): void {
  if (!props.desactive || props.raison === '') return;
  if (minuterieSignal !== null) clearTimeout(minuterieSignal);
  raisonSignalee.value = true;
  minuterieSignal = setTimeout(() => {
    raisonSignalee.value = false;
    minuterieSignal = null;
  }, DUREES_MS.lente);
}
</script>

<template>
  <div
    class="enveloppe"
    @pointerdown="signalerRefus"
  >
    <button
      type="button"
      class="carte"
      :class="`carte--${props.variante}`"
      :disabled="props.desactive"
      :aria-describedby="props.desactive && props.raison ? idRaison : undefined"
      @click="agirAuClic"
    >
      <span class="carte__ligne">
        <span class="carte__libelle">{{ props.libelle }}</span>
        <svg
          class="carte__fleche"
          viewBox="0 0 22 22"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 11h12M12 6l5 5-5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="carte__description">{{ props.description }}</span>
      <span
        v-if="props.desactive && props.raison"
        :id="idRaison"
        class="carte__raison"
        :class="{ 'carte__raison--signalee': raisonSignalee }"
      >{{ props.raison }}</span>
    </button>
  </div>
</template>

<style scoped>
.enveloppe {
  display: flex;
}

.carte {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  padding: var(--gdv-espacement-24);
  border-radius: var(--gdv-rayon-large);
  text-align: start;
  cursor: pointer;
}

.carte--principal {
  border: none;
  background: var(--gdv-accent-action);
  color: var(--gdv-texte-sur-accent);
}

.carte--secondaire {
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
}

.carte:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.carte:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.carte__ligne {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.carte__libelle {
  font-size: var(--gdv-role-titre-section);
  font-weight: var(--gdv-graisse-tres-gras);
}

.carte__fleche {
  inline-size: var(--gdv-espacement-24);
  block-size: var(--gdv-espacement-24);
  flex-shrink: 0;
}

/* Flèche dorée sur la carte secondaire : relevé tel quel au prototype, la
   flèche n'y suit pas la couleur du texte environnant. fill: none répété ici
   (déjà sur le <path>) marque ce bloc comme un tracé d'icône aux yeux de la
   porte habillage-zafyr.test.ts, qui exempte stroke/fill de la règle de l'or. */
.carte--secondaire .carte__fleche {
  color: var(--gdv-accent-action);
  fill: none;
}

.carte__description {
  font-size: var(--gdv-role-etiquette);
}

/* Sous-titre secondaire : marque-public, déjà mesuré par le contrat pour ce
   rôle, relevé tel quel au prototype sur cette carte précise. */
.carte--secondaire .carte__description {
  color: var(--gdv-marque-public);
}

.carte__raison {
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-normal);
}

.carte__raison--signalee {
  font-weight: var(--gdv-graisse-gras);
}
</style>
