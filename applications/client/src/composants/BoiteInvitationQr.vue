<script setup lang="ts">
// QR/code d'adhésion compact — écran 1 · Salle d'attente du prototype (le QR
// y est montré EN PERMANENCE, plus besoin d'un détour par ECR-04).
//
// jeton_hote n'est JAMAIS affiché. L'URL encodée dans le QR ne contient aucun
// jeton : seulement le code d'adhésion (API-GDV-001 / url_adhesion).

import { computed, ref } from 'vue';

import BandeauAlerte from './BandeauAlerte.vue';
import { tracerQr, urlAdhesion } from '../logique/code-qr.ts';
import { texte } from '../logique/contenu.ts';

interface Props {
  code: string;
}

const props = defineProps<Props>();
const lienCopie = ref(false);

const lien = computed(() =>
  urlAdhesion(globalThis.location?.origin ?? '', `/adhesion/${props.code}`),
);
const trace = computed(() => (props.code === '' ? null : tracerQr(lien.value)));

/** Partage natif si possible ; repli sur la copie du lien, jamais un bouton mort. */
async function partagerLien(): Promise<void> {
  const partage = globalThis.navigator?.share;
  if (partage !== undefined) {
    try {
      await partage.call(globalThis.navigator, { url: lien.value });
    } catch {
      // Partage annulé par le marchand : rien à signaler.
    }
    return;
  }
  await globalThis.navigator?.clipboard?.writeText(lien.value);
  lienCopie.value = true;
}
</script>

<template>
  <BandeauAlerte
    v-if="lienCopie"
    variante="succes"
    cle-contenu="ecran.salle_attente.lien_copie"
    @expirer="lienCopie = false"
  />

  <div class="invitation">
    <svg
      v-if="trace !== null"
      class="invitation__qr"
      :viewBox="`0 0 ${trace.taille} ${trace.taille}`"
      role="img"
      :aria-label="texte('ecran.invitation.alt_qr', { code: props.code })"
      shape-rendering="crispEdges"
    >
      <rect
        class="invitation__qr-fond"
        x="0"
        y="0"
        :width="trace.taille"
        :height="trace.taille"
      />
      <path
        class="invitation__qr-modules"
        :d="trace.chemin"
      />
    </svg>
    <div class="invitation__texte">
      <span class="invitation__etiquette">
        {{ texte('ecran.invitation.libelle_code') }}
      </span>
      <span class="invitation__code">{{ props.code }}</span>
      <button
        type="button"
        class="invitation__partager"
        @click="partagerLien"
      >
        {{ texte('ecran.salle_attente.partager_lien') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.invitation {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
}

.invitation__qr {
  flex-shrink: 0;
  inline-size: var(--gdv-espacement-96);
  block-size: var(--gdv-espacement-96);
  border-radius: var(--gdv-rayon-discret);
}

.invitation__qr-fond {
  fill: var(--gdv-surface-primaire);
}

.invitation__qr-modules {
  fill: var(--gdv-texte-principal);
}

.invitation__texte {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  min-inline-size: 0;
}

.invitation__etiquette {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-transform: uppercase;
  letter-spacing: var(--gdv-suivi-titre);
}

.invitation__code {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-titre-section);
  font-variant-numeric: var(--gdv-chiffres-variant);
  font-weight: var(--gdv-graisse-tres-gras);
  letter-spacing: var(--gdv-suivi-titre);
}

.invitation__partager {
  align-self: flex-start;
  margin-block-start: var(--gdv-espacement-4);
  min-block-size: var(--gdv-cible-minimale);
  padding-inline: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-pilule);
  background: transparent;
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-etiquette);
  cursor: pointer;
}

.invitation__partager:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}
</style>
