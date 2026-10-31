<script setup lang="ts">
// Validation d'un acte. Une seule variante PRINCIPALE par écran (Von Restorff).
//
// Le fichier s'appelle BoutonAction et non Bouton : la règle
// vue/multi-word-component-names, qui fait partie de la porte de lint, refuse
// un nom de composant d'un seul mot. Le rôle est celui du composant « Bouton »
// du contrat de conception, sans changement.
//
// Trois règles non négociables du contrat :
//  · un bouton désactivé porte TOUJOURS la raison du blocage juste dessous —
//    un bouton gris muet est un cul-de-sac ;
//  · en chargement, le libellé est conservé, jamais remplacé par un vide ;
//  · l'erreur n'est pas portée par le bouton — un bouton rouge ne dit pas quoi
//    faire. Elle est portée par BandeauAlerte.
//
// La variante « maintien » sert aux actes irréversibles à FAIBLE enjeu sous
// contrainte de temps (l'enquête) : le geste porte la confirmation, pour tenir
// dans une fenêtre de 60 s. Les actes à fort enjeu passent par le dialogue.
//
// ANO-UX-02 — « un état d'erreur n'est couvert que si l'utilisateur le lit »
// La raison existait déjà, et l'utilisateur ne l'a pas lue. Trois causes, et
// aucune n'est un oubli de libellé :
//   1. elle était SOUS le bouton, en role.meta et en texte-secondaire : le
//      texte le plus discret de l'écran, juste au moment où le regard est sur
//      le bouton. Elle est maintenant DANS le bouton, sous le libellé, donc à
//      l'endroit exact où le doigt appuie ;
//   2. elle n'était reliée au bouton par aucun aria-describedby : un lecteur
//      d'écran annonçait « Rejoindre une partie, indisponible » et rien de plus ;
//   3. un bouton `disabled` ne reçoit NI clic NI focus : l'appui ne produisait
//      strictement RIEN. C'est là la vraie cause du « ça ne marche pas » —
//      pas l'absence de message, mais l'absence de RÉACTION. L'enveloppe écoute
//      donc l'appui même quand le bouton est désactivé, et met la raison en
//      évidence pendant duree.lente. Un appui refusé répond toujours.

import { onBeforeUnmount, ref, useId } from 'vue';

import { DUREES_MS } from '../styles/jetons.ts';

export type VarianteBouton = 'principal' | 'secondaire' | 'discret' | 'destructeur';
export type TailleBouton = 'md' | 'lg';

interface Props {
  libelle: string;
  variante?: VarianteBouton;
  taille?: TailleBouton;
  desactive?: boolean;
  /** Obligatoire dès que `desactive` est vrai : sinon le joueur cherche. */
  raison?: string;
  chargement?: boolean;
  /** Exige un maintien de duree.maintien_confirmation avant d'émettre. */
  maintien?: boolean;
  pleineLargeur?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'principal',
  taille: 'md',
  desactive: false,
  raison: '',
  chargement: false,
  maintien: false,
  pleineLargeur: false,
});

const emettre = defineEmits<{ agir: [] }>();

const enMaintien = ref(false);
let minuterie: ReturnType<typeof setTimeout> | null = null;

function annuler(): void {
  if (minuterie !== null) clearTimeout(minuterie);
  minuterie = null;
  enMaintien.value = false;
}

onBeforeUnmount(annuler);

function commencer(): void {
  if (props.desactive || props.chargement || !props.maintien) return;
  enMaintien.value = true;
  minuterie = setTimeout(() => {
    annuler();
    emettre('agir');
  }, DUREES_MS['maintien-confirmation']);
}

/**
 * Les actions ordinaires utilisent click : c'est l'événement natif fiable sur
 * souris, tactile et clavier. Le maintien reste volontairement piloté par les
 * événements de pointeur pour conserver sa confirmation gestuelle.
 */
function agirAuClic(): void {
  if (props.maintien || props.desactive || props.chargement) return;
  emettre('agir');
}

// --- ANO-UX-02 : un appui refusé RÉPOND -------------------------------------

const idRaison = useId();
const raisonSignalee = ref(false);
let minuterieSignal: ReturnType<typeof setTimeout> | null = null;

function eteindreSignal(): void {
  if (minuterieSignal !== null) clearTimeout(minuterieSignal);
  minuterieSignal = null;
  raisonSignalee.value = false;
}

onBeforeUnmount(eteindreSignal);

/**
 * Appui sur un bouton désactivé. Capté par l'ENVELOPPE, parce qu'un élément
 * `disabled` ne reçoit aucun événement de pointeur : sans cela, l'appui est un
 * cul-de-sac silencieux, et c'est exactement ce que l'utilisateur a rencontré.
 */
function signalerRefus(): void {
  if (!props.desactive || props.raison === '') return;
  eteindreSignal();
  raisonSignalee.value = true;
  minuterieSignal = setTimeout(eteindreSignal, DUREES_MS.lente);
}
</script>

<template>
  <div
    class="enveloppe"
    :class="{ 'enveloppe--large': props.pleineLargeur }"
    @pointerdown="signalerRefus"
  >
    <button
      type="button"
      class="bouton"
      :class="[`bouton--${props.variante}`, `bouton--${props.taille}`, { 'bouton--maintien': enMaintien }]"
      :disabled="props.desactive"
      :aria-busy="props.chargement"
      :aria-describedby="props.desactive && props.raison ? idRaison : undefined"
      @click="agirAuClic"
      @pointerdown="commencer"
      @pointerup="annuler"
      @pointerleave="annuler"
      @keydown.space.prevent="commencer"
      @keyup.space.prevent="annuler"
    >
      <span class="bouton__libelle">{{ props.libelle }}</span>
      <!-- La raison est DANS le bouton, sous le libellé : à l'endroit où le
           doigt appuie, et non dans un paragraphe discret au-dessous. -->
      <span
        v-if="props.desactive && props.raison"
        :id="idRaison"
        class="bouton__raison"
        :class="{ 'bouton__raison--signalee': raisonSignalee }"
      >
        {{ props.raison }}
      </span>
      <!-- Barre indéterminée sous le libellé : le texte n'est jamais remplacé. -->
      <span
        v-if="props.chargement"
        class="bouton__barre"
        aria-hidden="true"
      />
      <!-- Remplissage du maintien : relâcher avant la fin annule sans effet. -->
      <span
        v-if="enMaintien"
        class="bouton__remplissage"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.enveloppe {
  display: inline-flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.enveloppe--large,
.enveloppe--large .bouton {
  width: 100%;
}

/* Rôle étiquette, pas méta : la raison d'un blocage n'est pas une mention
   légale. Elle hérite la couleur du bouton désactivé, qui est une paire
   dessinée (texte-desactive sur surface-desactivee). */
.bouton__raison {
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-normal);
  line-height: var(--gdv-interligne-courant);
  text-align: center;
}

/* Réponse à un appui refusé : la raison passe en texte-principal le temps de
   duree.lente. Un changement de COULEUR et de GRAISSE, jamais un mouvement :
   la réaction doit rester lisible sous prefers-reduced-motion. */
.bouton__raison--signalee {
  color: var(--gdv-texte-principal);
  font-weight: var(--gdv-graisse-gras);
}

.bouton {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gdv-espacement-4);
  padding-inline: var(--gdv-espacement-24);
  border: var(--gdv-trait-moyen) solid transparent;
  border-radius: var(--gdv-rayon-moyen);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-moyen);
  line-height: var(--gdv-interligne-courant);
  cursor: pointer;
  overflow: hidden;
  transition: background var(--gdv-duree-rapide) var(--gdv-courbe-standard);
}

.bouton--md {
  min-height: var(--gdv-hauteur-bouton-md);
}

.bouton--lg {
  min-height: var(--gdv-hauteur-bouton-lg);
}

.bouton--principal {
  background: var(--gdv-accent-action);
  color: var(--gdv-texte-sur-accent);
}

.bouton--principal:hover {
  background: var(--gdv-accent-action-survol);
}

.bouton--principal:active {
  background: var(--gdv-accent-action-actif);
}

/* Le libellé N'EST PAS en or : couleur._regle_or_jamais_en_texte_courant
   réserve la famille d'or aux rôles d'affichage (>= 20 px), aux bordures, aux
   pastilles pleines et aux tracés d'icône. Un libellé de bouton est composé en
   famille.interface au rôle corps, donc en texte-principal. Conséquence voulue
   (Von Restorff) : l'aplat d'or du bouton PRINCIPAL reste le seul or actionnable
   de l'écran, et se repère en moins de trois secondes. */
.bouton--secondaire {
  border-color: var(--gdv-bordure-champ);
  background: transparent;
  color: var(--gdv-texte-principal);
}

.bouton--secondaire:hover {
  background: var(--gdv-surface-secondaire);
}

.bouton--discret {
  background: transparent;
  color: var(--gdv-texte-secondaire);
}

.bouton--discret:focus-visible .bouton__libelle {
  text-decoration: underline;
}

.bouton--destructeur {
  border-color: var(--gdv-statut-echec);
  background: transparent;
  color: var(--gdv-statut-echec);
}

.bouton--destructeur:hover {
  background: var(--gdv-surface-secondaire);
}

/* L'anneau de focus est tracé SUR LA SURFACE ENVIRONNANTE, séparé du bouton
   par espacement.4 : la paire mesurée est accent-focus sur surface. */
.bouton:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.bouton:disabled {
  border-color: var(--gdv-bordure-structurante);
  border-width: var(--gdv-trait-fin);
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
  cursor: not-allowed;
}

.bouton__barre,
.bouton__remplissage {
  position: absolute;
  bottom: 0;
  left: 0;
  height: var(--gdv-trait-moyen);
  background: var(--gdv-texte-sur-accent);
}

.bouton__barre {
  width: 100%;
  animation: indeterminee var(--gdv-duree-lente) var(--gdv-courbe-standard) infinite alternate;
}

.bouton__remplissage {
  animation: remplir var(--gdv-duree-maintien-confirmation) linear forwards;
}

@keyframes indeterminee {
  from {
    transform: scaleX(0.2);
  }

  to {
    transform: scaleX(1);
  }
}

@keyframes remplir {
  from {
    width: 0;
  }

  to {
    width: 100%;
  }
}
</style>
