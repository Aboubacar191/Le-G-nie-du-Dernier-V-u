<script setup lang="ts">
// Substitut de contenu pendant le chargement. Jamais de vide blanc, jamais de
// tourniquet centré.
//
// Les dimensions du squelette sont celles du contenu attendu : c'est au parent
// de les donner, parce que lui seul sait ce qu'il attend. Un squelette à la
// mauvaise taille fait sauter la mise en page à l'arrivée des données.
//
// Il n'apparaît qu'au-delà de duree.seuil_chargement : en dessous, l'écran ne
// montre rien de transitoire (loi de Doherty). Le parent décide du moment ;
// ce composant ne porte que l'apparence.

interface Props {
  /** Nombre de blocs empilés, aux dimensions du contenu attendu. */
  lignes?: number;
  /** Hauteur d'un bloc : un jeton de hauteur, jamais une valeur littérale. */
  hauteur?: string;
  /** Libellé de progression, lu par les lecteurs d'écran. Clé de contenu. */
  libelle: string;
}

const props = withDefaults(defineProps<Props>(), {
  lignes: 3,
  hauteur: 'var(--gdv-cible-minimale)',
});
</script>

<template>
  <div
    class="squelette"
    aria-busy="true"
  >
    <span class="squelette__libelle">{{ libelle }}</span>
    <div
      v-for="ligne in props.lignes"
      :key="ligne"
      class="squelette__bloc"
      :style="{ height: props.hauteur }"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.squelette {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  width: 100%;
}

/* Le libellé de progression existe pour les lecteurs d'écran : il est retiré du
   rendu visuel sans être retiré de l'arbre d'accessibilité. */
.squelette__libelle {
  position: absolute;
  width: var(--gdv-trait-fin);
  height: var(--gdv-trait-fin);
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.squelette__bloc {
  background: var(--gdv-surface-secondaire);
  border-radius: var(--gdv-rayon-discret);
  width: 100%;
}

/* Balayage léger. Sous mouvement réduit, surface fixe : voir plus bas. */
@media (prefers-reduced-motion: no-preference) {
  .squelette__bloc {
    background: linear-gradient(
      90deg,
      var(--gdv-surface-secondaire) 25%,
      var(--gdv-surface-desactivee) 50%,
      var(--gdv-surface-secondaire) 75%
    );
    background-size: 400% 100%;
    animation: balayage var(--gdv-duree-lente) linear infinite;
  }
}

@keyframes balayage {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: 0 0;
  }
}
</style>
