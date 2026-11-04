<script setup lang="ts">
// Rangée « Apprendre les règles » de C · Accueil — extraite de
// composants/AccueilMenu.vue (porte de lint max-lines). Purement
// présentationnel : ouvre composants/ReglesExplicatives.vue, via l'appelant.

import { texte } from '../logique/contenu.ts';

defineEmits<{ ouvrir: [] }>();
</script>

<template>
  <button
    type="button"
    class="carte-regles"
    @click="$emit('ouvrir')"
  >
    <span class="carte-regles__icone">
      <svg
        viewBox="0 0 22 22"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4 4h6a2 2 0 012 2v12a2 2 0 00-2-2H4zM18 4h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="carte-regles__texte">
      <span class="carte-regles__titre">{{ texte('ecran.accueil.apprendre_regles') }}</span>
      <span class="carte-regles__description">{{ texte('ecran.accueil.apprendre_regles_description') }}</span>
    </span>
  </button>
</template>

<style scoped>
.carte-regles {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-large);
  background: transparent;
  color: var(--gdv-texte-principal);
  text-align: start;
  cursor: pointer;
}

.carte-regles:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

/* fill: none marque ce bloc comme un tracé d'icône aux yeux de la porte
   habillage-zafyr.test.ts (même mécanisme que CarteAction.vue). */
.carte-regles__icone {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-accent-action);
  fill: none;
}

.carte-regles__icone svg {
  inline-size: var(--gdv-espacement-24);
  block-size: var(--gdv-espacement-24);
}

.carte-regles__texte {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.carte-regles__titre {
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-tres-gras);
}

.carte-regles__description {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}
</style>
