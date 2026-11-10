<script setup lang="ts">
// Résumé de création — écran D du prototype (sélecteurs manches ET
// négociation, résumé pièces/joueurs, durée estimée). Extrait de
// vues/EcranCreationSession.vue (porte de lint max-lines) : purement
// présentationnel, tout le calcul reste porté par l'appelant.

import BasculeReglage from './BasculeReglage.vue';
import { texte } from '../logique/contenu.ts';
import type { ConfigJeuPublique } from '../transport/rest.ts';

interface Props {
  candidatsManches: readonly number[];
  manchesChoisies: number;
  candidatsNegociation: readonly number[];
  negociationChoisieS: number;
  defauts: ConfigJeuPublique | null;
  dureeEstimeeMin: number | null;
  modeAvance: boolean;
  modeAvanceDesactive: boolean;
  modeAvanceRaison: string;
}

const props = defineProps<Props>();
const emettre = defineEmits<{
  choisirManches: [n: number];
  choisirNegociation: [s: number];
  'update:modeAvance': [actif: boolean];
}>();

/** « 90 » → « 1:30 ». Affichage de pastille uniquement, pas une donnée de jeu. */
function minSec(secondes: number): string {
  const min = Math.floor(secondes / 60);
  const reste = String(secondes % 60).padStart(2, '0');
  return `${min}:${reste}`;
}
</script>

<template>
  <div
    v-if="props.candidatsManches.length > 0"
    class="resume__manches"
  >
    <p class="resume__manches-libelle">
      {{ texte('ecran.creation.nb_manches_libelle') }}
    </p>
    <div
      class="resume__pastilles"
      role="group"
      :aria-label="texte('ecran.creation.nb_manches_libelle')"
    >
      <button
        v-for="n in props.candidatsManches"
        :key="n"
        type="button"
        class="resume__pastille"
        :class="{ 'resume__pastille--choisie': n === props.manchesChoisies }"
        :aria-pressed="n === props.manchesChoisies"
        @click="emettre('choisirManches', n)"
      >
        {{ n }}
      </button>
    </div>
  </div>

  <div
    v-if="props.candidatsNegociation.length > 0"
    class="resume__manches"
  >
    <p class="resume__manches-libelle">
      {{ texte('ecran.creation.negociation_libelle') }}
    </p>
    <div
      class="resume__pastilles"
      role="group"
      :aria-label="texte('ecran.creation.negociation_libelle')"
    >
      <button
        v-for="s in props.candidatsNegociation"
        :key="s"
        type="button"
        class="resume__pastille"
        :class="{ 'resume__pastille--choisie': s === props.negociationChoisieS }"
        :aria-pressed="s === props.negociationChoisieS"
        @click="emettre('choisirNegociation', s)"
      >
        {{ minSec(s) }}
      </button>
    </div>
  </div>

  <dl
    v-if="props.defauts"
    class="resume__liste"
  >
    <div class="resume__ligne">
      <dt>{{ texte('ecran.creation.pieces_depart_libelle') }}</dt>
      <dd>{{ texte('ecran.creation.pieces_depart_valeur', { valeur: props.defauts.pieces_initiales }) }}</dd>
    </div>
    <div class="resume__ligne">
      <dt>{{ texte('ecran.creation.joueurs_libelle') }}</dt>
      <dd>
        {{ texte('ecran.creation.joueurs_valeur', {
          min: props.defauts.joueurs_min, max: props.defauts.joueurs_max
        }) }}
      </dd>
    </div>
    <div class="resume__ligne resume__ligne--bascule">
      <BasculeReglage
        :actif="props.modeAvance"
        :libelle="texte('ecran.creation.mode_avance')"
        :mot-actif="texte('ecran.salle_attente.mode_avance_actif')"
        :mot-inactif="texte('ecran.salle_attente.mode_avance_inactif')"
        :desactive="props.modeAvanceDesactive"
        :raison="props.modeAvanceRaison"
        @update:actif="emettre('update:modeAvance', $event)"
      />
    </div>
  </dl>

  <p
    v-if="props.dureeEstimeeMin !== null"
    class="resume__duree"
  >
    <span>{{ texte('ecran.creation.duree_estimee_libelle') }}</span>
    <span class="resume__duree-valeur">
      {{ texte('ecran.creation.duree_estimee_valeur', { minutes: props.dureeEstimeeMin }) }}
    </span>
  </p>
</template>

<style scoped>
.resume__manches {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.resume__manches-libelle {
  margin: 0;
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-tres-gras);
}

.resume__pastilles {
  display: flex;
  gap: var(--gdv-espacement-8);
}

.resume__pastille {
  flex: 1 1 auto;
  min-block-size: var(--gdv-cible-minimale);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-chiffres);
  font-variant-numeric: var(--gdv-chiffres-variant);
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-tres-gras);
  cursor: pointer;
}

.resume__pastille--choisie {
  border-color: transparent;
  background: var(--gdv-accent-action);
  color: var(--gdv-texte-sur-accent);
}

.resume__pastille:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.resume__liste {
  display: flex;
  flex-direction: column;
  margin: 0;
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  overflow: hidden;
}

.resume__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-12);
}

.resume__ligne:not(:last-child) {
  border-bottom: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
}

.resume__ligne--bascule {
  align-items: center;
}

.resume__ligne dt {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.resume__ligne dd {
  margin: 0;
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-tres-gras);
}

.resume__duree {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-secret);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  font-size: var(--gdv-role-etiquette);
}

/* Pas d'or : role-etiquette est sous le seuil d'affichage de
   _regle_or_jamais_en_texte_courant. Le poids suffit à la distinguer. */
.resume__duree-valeur {
  color: var(--gdv-texte-principal);
  font-weight: var(--gdv-graisse-tres-gras);
}
</style>
