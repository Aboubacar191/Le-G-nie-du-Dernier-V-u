<script setup lang="ts">
// Réordonnancement du cercle par GLISSER-DÉPOSER — fidélité à la maquette
// (écran 1 · Salle d'attente, « Glisse pour réordonner »), sur demande
// explicite malgré l'ancien arbitrage d'ECR-07 (désignation séquentielle).
//
// L'ancien arbitrage disait le glisser-déposer « fragile au tactile,
// inutilisable au clavier ». Les deux reproches sont traités ici, pas
// contournés :
//  · tactile ET souris par POINTER EVENTS (pointerdown/move/up), jamais l'API
//    HTML5 Drag and Drop — celle-ci n'émet rien de fiable au doigt sur les
//    navigateurs mobiles, exactement la fragilité reprochée ;
//  · clavier par DEUX BOUTONS Monter/Descendre par ligne, TOUJOURS visibles
//    (jamais seulement au survol ou au focus) : le même déplacement qu'un
//    glissement, un contact à la fois, sans jamais avoir à glisser.
//
// Algorithme de glissement : la ligne tenue suit le doigt EN CONTINU (un
// style transform direct, jamais de transition pendant le geste — une
// animation allongerait l'écart perçu entre le doigt et la ligne). Elle
// franchit une ligne voisine dès que le DÉPLACEMENT CUMULÉ dépasse une
// hauteur de ligne ; l'écart restant (celui qui n'a pas encore fait franchir
// de ligne) reste porté par le transform, pour que le doigt ne « saute »
// jamais au relâchement.

import { nextTick, ref, type ComponentPublicInstance } from 'vue';

import type { JoueurPublic } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';

interface Props {
  joueurs: readonly JoueurPublic[];
  moiId: string;
  ordre: readonly string[];
}

const props = defineProps<Props>();
const emettre = defineEmits<{ 'update:ordre': [ordre: string[]] }>();

interface Glissement {
  readonly indexDepart: number;
  indexCourant: number;
  readonly departY: number;
  readonly hauteur: number;
  readonly pointeurId: number;
}

const glissement = ref<Glissement | null>(null);
const decalageVisuel = ref(0);
const lignesEl = ref<(HTMLElement | null)[]>([]);

function pseudoDe(joueurId: string): string {
  return props.joueurs.find((joueur) => joueur.joueur_id === joueurId)?.pseudo ?? joueurId;
}

function connecteDe(joueurId: string): boolean {
  return props.joueurs.find((joueur) => joueur.joueur_id === joueurId)?.connecte ?? false;
}

function echanger(index: number, autre: number): void {
  if (autre < 0 || autre >= props.ordre.length) return;
  const suivant = [...props.ordre];
  [suivant[index], suivant[autre]] = [suivant[autre] as string, suivant[index] as string];
  emettre('update:ordre', suivant);
}

/** Bouton Monter/Descendre : le même déplacement qu'un glissement, un contact à la fois. */
function deplacerAuClavier(index: number, sens: -1 | 1): void {
  echanger(index, index + sens);
}

function demarrerGlissement(index: number, evenement: PointerEvent): void {
  const ligne = lignesEl.value[index];
  if (ligne === null || ligne === undefined) return;
  (evenement.currentTarget as HTMLElement).setPointerCapture(evenement.pointerId);
  glissement.value = {
    indexDepart: index,
    indexCourant: index,
    departY: evenement.clientY,
    hauteur: ligne.getBoundingClientRect().height,
    pointeurId: evenement.pointerId,
  };
  decalageVisuel.value = 0;
}

function deplacerGlissement(evenement: PointerEvent): void {
  const etat = glissement.value;
  if (etat === null || evenement.pointerId !== etat.pointeurId) return;
  const deltaCumule = evenement.clientY - etat.departY;
  const pas = Math.round(deltaCumule / etat.hauteur);
  const cible = Math.min(
    props.ordre.length - 1,
    Math.max(0, etat.indexDepart + pas),
  );
  if (cible !== etat.indexCourant) {
    echanger(etat.indexCourant, cible);
    etat.indexCourant = cible;
  }
  decalageVisuel.value = deltaCumule - (etat.indexCourant - etat.indexDepart) * etat.hauteur;
}

function terminerGlissement(): void {
  glissement.value = null;
  decalageVisuel.value = 0;
}

async function enregistrerLigne(index: number, el: Element | ComponentPublicInstance | null): Promise<void> {
  await nextTick();
  lignesEl.value[index] = el instanceof HTMLElement ? el : null;
}
</script>

<template>
  <ol class="reordonneur">
    <li
      v-for="(joueurId, index) in props.ordre"
      :key="joueurId"
      :ref="(el) => enregistrerLigne(index, el)"
      class="reordonneur__ligne"
      :class="{ 'reordonneur__ligne--glissee': glissement?.indexCourant === index }"
      :style="glissement?.indexCourant === index ? { transform: `translateY(${decalageVisuel}px)` } : {}"
    >
      <p class="reordonneur__numero">
        {{ texte('cercle.siege', { numero: index + 1 }) }}
      </p>

      <span class="reordonneur__identite">
        <span class="reordonneur__pseudo">{{ pseudoDe(joueurId) }}</span>
        <span
          v-if="joueurId === props.moiId"
          class="reordonneur__meta"
        >{{ texte('commun.moi') }}</span>
        <span
          v-else-if="!connecteDe(joueurId)"
          class="reordonneur__meta"
        >{{ texte('carte_joueur.deconnecte') }}</span>
      </span>

      <!-- Clavier : un contact par déplacement, toujours visible. -->
      <span class="reordonneur__clavier">
        <button
          type="button"
          class="reordonneur__bouton-clavier"
          :disabled="index === 0"
          :aria-label="texte('cercle.monter', { pseudo: pseudoDe(joueurId) })"
          @click="deplacerAuClavier(index, -1)"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M8 12V4M4 7.5 8 4l4 3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="reordonneur__bouton-clavier"
          :disabled="index === props.ordre.length - 1"
          :aria-label="texte('cercle.descendre', { pseudo: pseudoDe(joueurId) })"
          @click="deplacerAuClavier(index, 1)"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M8 4v8M4 8.5 8 12l4-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </span>

      <!-- Tactile et souris : la poignée, seule zone qui démarre le geste. -->
      <button
        type="button"
        class="reordonneur__poignee"
        :aria-label="texte('cercle.glisser', { pseudo: pseudoDe(joueurId) })"
        @pointerdown.prevent="demarrerGlissement(index, $event)"
        @pointermove="deplacerGlissement"
        @pointerup="terminerGlissement"
        @pointercancel="terminerGlissement"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 4h.01M11 4h.01M5 8h.01M11 8h.01M5 12h.01M11 12h.01"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </li>
  </ol>
</template>

<style scoped>
.reordonneur {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.reordonneur__ligne {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
  min-block-size: var(--gdv-cible-geante);
  padding: var(--gdv-espacement-8) var(--gdv-espacement-12);
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
  transition: transform 0.15s ease-out;
}

/* Pendant le geste : AUCUNE transition, le transform doit suivre le doigt
   image par image, sans retard ni rattrapage animé. */
.reordonneur__ligne--glissee {
  position: relative;
  z-index: 1;
  border-color: var(--gdv-accent-action);
  box-shadow: var(--gdv-elevation-flottante);
  transition: none;
}

.reordonneur__numero {
  margin: 0;
  min-inline-size: var(--gdv-cible-confortable);
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-etiquette);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

.reordonneur__identite {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  min-inline-size: 0;
}

.reordonneur__pseudo {
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-moyen);
}

.reordonneur__meta {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.reordonneur__clavier {
  display: flex;
  flex-shrink: 0;
  gap: var(--gdv-espacement-4);
}

.reordonneur__bouton-clavier {
  display: grid;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-principal);
  cursor: pointer;
}

.reordonneur__bouton-clavier:disabled {
  color: var(--gdv-texte-desactive);
  cursor: not-allowed;
}

.reordonneur__bouton-clavier svg {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
}

.reordonneur__bouton-clavier:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

/* La plus grande cible tactile de la ligne : c'est elle qu'on tient. */
.reordonneur__poignee {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--gdv-cible-geante);
  block-size: var(--gdv-cible-geante);
  border: none;
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-secondaire);
  cursor: grab;
  touch-action: none;
}

.reordonneur__poignee:active {
  cursor: grabbing;
}

.reordonneur__poignee svg {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
}

.reordonneur__poignee:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}
</style>
