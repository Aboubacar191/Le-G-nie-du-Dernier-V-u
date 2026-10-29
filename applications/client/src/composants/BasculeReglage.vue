<script setup lang="ts">
// Réglages de l'hôte : mode avancé, thème, côté dominant.
//
// Jamais la couleur seule : l'état est doublé du mot « Activé » ou « Désactivé »
// à côté de la bascule. Une bascule désactivée affiche sa RAISON dessous — une
// bascule grise muette laisse l'hôte chercher pourquoi il ne peut pas l'activer.

import { useId } from 'vue';

interface Props {
  actif: boolean;
  libelle: string;
  /** Mot d'état affiché à côté : jamais la couleur seule. */
  motActif: string;
  motInactif: string;
  desactive?: boolean;
  /** Obligatoire quand `desactive` est vrai. */
  raison?: string;
  erreur?: string;
}

const props = withDefaults(defineProps<Props>(), {
  desactive: false,
  raison: '',
  erreur: '',
});

const emettre = defineEmits<{ 'update:actif': [actif: boolean] }>();

const identifiant = useId();

function basculer(): void {
  if (props.desactive) return;
  // Bascule optimiste : le retour arrière est visible si le serveur refuse.
  emettre('update:actif', !props.actif);
}
</script>

<template>
  <div class="bascule">
    <div class="bascule__rangee">
      <label
        class="bascule__libelle"
        :for="identifiant"
      >{{ props.libelle }}</label>

      <button
        :id="identifiant"
        type="button"
        class="bascule__piste"
        :class="{ 'bascule__piste--actif': props.actif, 'bascule__piste--erreur': props.erreur !== '' }"
        role="switch"
        :aria-checked="props.actif"
        :disabled="props.desactive"
        @click="basculer"
      >
        <span
          class="bascule__pastille"
          aria-hidden="true"
        />
      </button>

      <span class="bascule__mot">{{ props.actif ? props.motActif : props.motInactif }}</span>
    </div>

    <p
      v-if="props.desactive && props.raison"
      class="bascule__raison"
    >
      {{ props.raison }}
    </p>
    <p
      v-if="props.erreur"
      class="bascule__erreur"
    >
      {{ props.erreur }}
    </p>
  </div>
</template>

<style scoped>
.bascule {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.bascule__rangee {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
}

.bascule__libelle {
  flex: 1 1 auto;
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
}

.bascule__piste {
  flex: none;
  display: inline-flex;
  align-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-espacement-32);
  min-block-size: var(--gdv-espacement-32);
  padding: var(--gdv-espacement-4);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-desactivee);
  cursor: pointer;
  transition: background var(--gdv-duree-rapide) var(--gdv-courbe-standard);
}

.bascule__piste--actif {
  justify-content: flex-end;
  background: var(--gdv-accent-action);
}

.bascule__piste--erreur {
  border-color: var(--gdv-statut-echec);
  border-width: var(--gdv-trait-moyen);
}

.bascule__piste:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.bascule__piste:disabled {
  background: var(--gdv-surface-desactivee);
  cursor: not-allowed;
}

.bascule__pastille {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-primaire);
}

.bascule__piste--actif .bascule__pastille {
  background: var(--gdv-texte-sur-accent);
}

.bascule__piste:disabled .bascule__pastille {
  background: var(--gdv-texte-desactive);
}

.bascule__mot {
  flex: none;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.bascule__raison {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.bascule__erreur {
  margin: 0;
  color: var(--gdv-statut-echec);
  font-size: var(--gdv-role-meta);
}
</style>
