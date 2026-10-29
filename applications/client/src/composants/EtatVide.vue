<script setup lang="ts">
// Tout état vide propose une SORTIE. Un écran vide sans action est un cul-de-sac.
//
// Quand le joueur ne peut que patienter, la sortie n'est pas un bouton décoratif
// mais une information de progression concrète (« Il manque 2 marchands. 5 au
// minimum, 8 au maximum »). Un compte à rebours faux est interdit.
//
// Un ÉCHEC de chargement n'est jamais rendu ici : c'est la confusion la plus
// coûteuse du jeu, elle ferait croire à un joueur qu'il n'a rien reçu du génie
// alors qu'il n'a pas pu recevoir. L'échec passe par BandeauAlerte.

interface Props {
  titre: string;
  corps?: string;
  /** Libellé de l'action de sortie. Absent = cas « sans action possible ». */
  actionLibelle?: string;
  /** Information de progression, quand la seule sortie est d'attendre. */
  progression?: string;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ agir: [] }>();
</script>

<template>
  <div class="vide">
    <p class="vide__titre">
      {{ props.titre }}
    </p>
    <p
      v-if="props.corps"
      class="vide__corps"
    >
      {{ props.corps }}
    </p>
    <p
      v-if="props.progression"
      class="vide__progression"
    >
      {{ props.progression }}
    </p>
    <button
      v-if="props.actionLibelle"
      type="button"
      class="vide__action"
      @click="emettre('agir')"
    >
      {{ props.actionLibelle }}
    </button>
  </div>
</template>

<style scoped>
.vide {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--gdv-espacement-8);
  background: transparent;
  padding: var(--gdv-espacement-24);
  max-width: var(--gdv-mesure-ligne-etroit);
}

.vide__titre {
  margin: 0;
  color: var(--gdv-texte-principal);
  font-size: var(--gdv-role-titre-section);
  line-height: var(--gdv-interligne-titre);
}

.vide__corps,
.vide__progression {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

/* Écart corps → action : espacement.24, prescrit par le contrat de conception. */
.vide__action {
  margin-top: var(--gdv-espacement-16);
  min-height: var(--gdv-hauteur-bouton-md);
  padding-inline: var(--gdv-espacement-24);
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-moyen);
  cursor: pointer;
}

.vide__action:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}
</style>
