<script setup lang="ts">
// Conteneur des actions ponctuelles : transfert, prêt, panneau de solde,
// réglages. Feuille montante, parce que le pouce est en bas.
//
// Sur ERREUR, la feuille RESTE OUVERTE et les saisies sont conservées : fermer
// la feuille sur erreur perdrait le travail du joueur dans une fenêtre minutée.
//
// Piège de focus, Échap toujours, restitution du focus à l'élément déclencheur
// à la fermeture.

import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';

import { texte } from '../logique/contenu.ts';

interface Props {
  titre: string;
  ouverte: boolean;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ fermer: [] }>();

const feuille = ref<HTMLElement | null>(null);
const idTitre = `${useId()}-titre`;
let declencheur: Element | null = null;

const SELECTEUR_FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  const racine = feuille.value;
  if (racine === null) return [];
  return [...racine.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)];
}

/** Piège de focus : la tabulation ne sort pas de la feuille tant qu'elle est là. */
function piegerFocus(evenement: KeyboardEvent): void {
  const elements = focusables();
  if (elements.length === 0) return;
  const premier = elements[0] as HTMLElement;
  const dernier = elements[elements.length - 1] as HTMLElement;
  const actif = globalThis.document.activeElement;
  if (evenement.shiftKey && actif === premier) {
    evenement.preventDefault();
    dernier.focus();
    return;
  }
  if (!evenement.shiftKey && actif === dernier) {
    evenement.preventDefault();
    premier.focus();
  }
}

onMounted(async () => {
  declencheur = globalThis.document.activeElement;
  await nextTick();
  focusables()[0]?.focus();
});

onBeforeUnmount(() => {
  (declencheur as HTMLElement | null)?.focus?.();
});
</script>

<template>
  <div
    v-if="props.ouverte"
    class="arriere"
    @click.self="emettre('fermer')"
  >
    <section
      ref="feuille"
      class="feuille"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="idTitre"
      @keydown.esc="emettre('fermer')"
      @keydown.tab="piegerFocus"
    >
      <div
        class="feuille__poignee"
        aria-hidden="true"
      />
      <header class="feuille__entete">
        <h2
          :id="idTitre"
          class="feuille__titre"
        >
          {{ props.titre }}
        </h2>
        <button
          type="button"
          class="feuille__fermer"
          @click="emettre('fermer')"
        >
          {{ texte('commun.fermer') }}
        </button>
      </header>
      <div class="feuille__corps">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.arriere {
  position: fixed;
  inset: 0;
  z-index: var(--gdv-zindex-feuille);
  display: flex;
  align-items: flex-end;
  /* Voile arrière à 60 % d'opacité, posé sur le jeton de voile de secret. */
  background: color-mix(in srgb, var(--gdv-secret-voile) 60%, transparent);
}

.feuille {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  inline-size: 100%;
  max-block-size: 90%;
  padding: var(--gdv-espacement-24);
  border-start-start-radius: var(--gdv-rayon-large);
  border-start-end-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-primaire);
  box-shadow: var(--gdv-elevation-flottante);
  color: var(--gdv-texte-principal);
  overflow-y: auto;
  animation: monter var(--gdv-duree-normale) var(--gdv-courbe-sortie);
}

.feuille__poignee {
  align-self: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-trait-epais);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-bordure-structurante);
}

.feuille__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.feuille__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.feuille__fermer {
  min-block-size: var(--gdv-hauteur-bouton-md);
  padding-inline: var(--gdv-espacement-16);
  border: none;
  background: none;
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  cursor: pointer;
}

.feuille__fermer:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.feuille__corps {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

@keyframes monter {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feuille {
    animation: none;
  }
}
</style>
