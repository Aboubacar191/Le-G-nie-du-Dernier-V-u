<script setup lang="ts">
// Garde d'orientation — le manifeste PWA déclare déjà orientation: "portrait",
// mais cette contrainte n'est imposée par le système d'exploitation QUE pour
// une PWA installée. Ouvert dans un onglet de navigateur ordinaire — le cas
// courant d'une première partie — rien n'empêche la rotation.
//
// Conséquence du conseil LLM convoqué sur la stratégie responsive : le pire
// cas mesuré (bandeau de phase + minuteur + huit lignes de joueurs + fenêtre
// de lecture d'un secret au plancher de M4) n'a de solution mathématique
// qu'en PORTRAIT. En paysage sur un petit téléphone, la hauteur utile chute
// bien en-dessous de ce qu'elle est en portrait : aucune mise en page ne peut
// à la fois tenir cet espace réduit et respecter le plancher de lisibilité.
// La bonne réponse n'est donc pas de comprimer l'impossible, c'est de refuser
// l'orientation que le manifeste a déjà exclue, y compris hors installation.
//
// Couche BLOQUANTE et volontairement minimale : ce qui reste monté dessous
// pendant qu'elle est visible n'a pas d'importance, puisque rien n'y est
// interactif en paysage — seul ce message l'est.

import { texte } from '../logique/contenu.ts';
</script>

<template>
  <div
    class="garde-orientation"
    role="alert"
  >
    <p class="garde-orientation__titre">
      {{ texte('commun.orientation_tourne_titre') }}
    </p>
    <p class="garde-orientation__detail">
      {{ texte('commun.orientation_tourne_detail') }}
    </p>
  </div>
</template>

<style scoped>
.garde-orientation {
  display: none;
}

/* Point de rupture : exception technique déjà admise par le contrat (une
   variable CSS ne fonctionne pas dans une règle @media). */
@media (orientation: landscape) {
  .garde-orientation {
    position: fixed;
    inset: 0;
    z-index: var(--gdv-zindex-alerte);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gdv-espacement-12);
    padding: var(--gdv-gouttiere-ecran);
    background: var(--gdv-surface-fond);
    color: var(--gdv-texte-principal);
    text-align: center;
  }
}

.garde-orientation__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
}

.garde-orientation__detail {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
}
</style>
