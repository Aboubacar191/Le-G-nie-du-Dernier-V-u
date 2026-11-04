<script setup lang="ts">
// Sélecteur de la couleur d'avatar — reproduit l'intention de l'écran B ·
// Bienvenue du prototype (reference-prototype/
// b-bienvenue-premiere-ouverture.ecran.html), mais PAS son rendu : le
// prototype remplit un médaillon de 112 px avec la couleur et y pose
// l'initiale du pseudo en texte. C'est exactement ce que le contrat de
// conception interdit pour une couleur de joueur (DESIGN-GDV-001.json,
// contraste_verifie._note_couleurs_de_joueur) : six couleurs libres ne
// peuvent pas garantir un ratio de texte à travers les deux thèmes.
//
// Ici : une pastille PLEINE mais SANS AUCUN texte dessus (donc hors de la
// règle qu'elle enfreindrait), bordée par un jeton de thème, jamais seule
// porteuse de l'identité — le pseudo saisi juste à côté reste la seule
// source fiable, comme l'exige la seconde règle du contrat.
//
// Purement local : aucune couleur n'est envoyée au serveur ni au protocole.
// Le GDD ne lui donne aucun rôle de jeu ; en faire une donnée de session
// aurait ajouté un champ au contrat API et à sa matrice de visibilité pour un
// choix qui ne sert qu'au joueur qui le fait.

import { COULEURS_JOUEUR } from '../logique/couleurs-joueur.ts';
import { texte } from '../logique/contenu.ts';

interface Props {
  modelValue: string;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ 'update:modelValue': [valeur: string] }>();
</script>

<template>
  <div
    class="selecteur"
    role="group"
    :aria-label="texte('ecran.accueil.libelle_couleur')"
  >
    <button
      v-for="couleur in COULEURS_JOUEUR"
      :key="couleur.id"
      type="button"
      class="selecteur__pastille"
      :class="{ 'selecteur__pastille--choisie': couleur.id === props.modelValue }"
      :style="{ background: couleur.hex }"
      :aria-pressed="couleur.id === props.modelValue"
      :aria-label="couleur.libelle"
      @click="emettre('update:modelValue', couleur.id)"
    >
      <!-- Coche, jamais la couleur seule : l'état choisi est porté par un
           second signal visuel (anneau + glyphe), pas uniquement par un
           changement de teinte de bordure. -->
      <svg
        v-if="couleur.id === props.modelValue"
        class="selecteur__coche"
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M3 8.5l3 3 7-7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.selecteur {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-12);
}

.selecteur__pastille {
  display: grid;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border-radius: var(--gdv-rayon-pilule);
  border: var(--gdv-trait-epais) solid var(--gdv-bordure-structurante);
  cursor: pointer;
}

.selecteur__pastille--choisie {
  border-color: var(--gdv-accent-focus);
}

.selecteur__pastille:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

/* La coche est tracée en texte-sur-accent : la paire est déjà mesurée par le
   contrat pour un trait porteur de sens sur un aplat d'accent, et chaque
   pastille a un contraste individuellement mesuré bien au-dessus du seuil
   « ui » 3:1 (voir logique/couleurs-joueur.ts). */
.selecteur__coche {
  inline-size: var(--gdv-espacement-24);
  block-size: var(--gdv-espacement-24);
  color: var(--gdv-texte-sur-accent);
}
</style>
