<script setup lang="ts">
// Marque de tête — écran 1 du prototype (vue hôte uniquement). Extrait de
// vues/EcranSalleAttente.vue (porte de lint max-lines) : statique, aucune
// donnée à recevoir.

import { texte } from '../logique/contenu.ts';
</script>

<template>
  <div class="marque">
    <svg
      viewBox="0 0 56 56"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 38c6 4 30 4 36 0M14 38c0-8 6-14 14-14s14 6 14 14M28 24v-6m0 0c-3-3-1-8 3-9-1 3 1 5 3 6-2 0-4 1-6 3z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M46 38c3 0 5-2 5-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
    <h1 class="marque__titre">
      {{ texte('commun.titre_application') }}
    </h1>
    <p class="marque__accroche">
      {{ texte('ecran.salle_attente.accroche') }}
    </p>
  </div>
</template>

<style scoped>
.marque {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-8);
  text-align: center;
}

.marque svg {
  inline-size: var(--gdv-cible-geante);
  block-size: var(--gdv-cible-geante);
  fill: none;
  color: var(--gdv-accent-action);
}

.marque__titre {
  margin: 0;
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
  color: var(--gdv-accent-action);
}

.marque__accroche {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}
</style>
