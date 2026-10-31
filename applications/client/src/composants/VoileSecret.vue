<script setup lang="ts">
// VoileSecret — composant central du dispositif anti-regard-du-voisin.
//
// Enveloppe TOUTE donnée secrète, en lecture comme en saisie. Aucun secret ne
// s'affiche hors de ce composant. La sécurité serveur garantit qu'aucun secret
// d'autrui n'atteint l'appareil ; elle ne couvre pas le canal de fuite réel du
// jeu en présentiel, qui est le voisin assis qui lit l'écran de biais.
//
// M1 — masqué à l'arrivée, toujours. Le contenu secret N'EST PAS RENDU dans
//      l'arbre : `v-if` et non `v-show`, et aucune valeur dans un title, un
//      aria-label, un champ caché ni un nœud hors écran.
// M2 — révélation par geste maintenu, au plus duree.revelation_maintien_max.
//      Chemin accessible obligatoire : un contact simple ouvre une révélation
//      minutée, pour les joueurs qui ne peuvent pas maintenir un appui. Les
//      deux chemins sont actionnables au clavier.
// M3 — remasquage immédiat et sans animation sur relâchement, expiration,
//      perte de focus de la fenêtre, changement de visibilité et défilement.
// M4 — la valeur révélée tient dans une fenêtre de 96 × 64 ancrée dans le tiers
//      inférieur, du côté que la main qui tient l'appareil occulte. Le
//      contraste n'est JAMAIS dégradé pour cacher : on réduit l'empreinte
//      physique et l'angle utile, pas la lisibilité.
// M5 — après validation, l'état « scelle » ne porte plus aucune valeur.
//
// Aucun retour haptique ni sonore n'est émis à la révélation : un voisin
// l'entendrait.

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { texte } from '../logique/contenu.ts';
import { cleLibelle, estRevele, transiter, zoneActionnable, type EtatVoile } from '../logique/voile.ts';
import { DUREES_MS } from '../styles/jetons.ts';
import MinuteurPhase from './MinuteurPhase.vue';
import SqueletteChargement from './SqueletteChargement.vue';

export type VarianteVoile = 'lecture' | 'saisie' | 'choix' | 'pleine_page';

interface Props {
  variante?: VarianteVoile;
  /** Libellé persistant de la carte. Public : il ne chiffre rien. */
  intitule: string;
  /** Force un état non interactif : chargement, erreur, scelle, desactive. */
  etatImpose?: EtatVoile | null;
  /** Clé de rendu : tout changement remasque (M3, changement de phase). */
  clePhase?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'lecture',
  etatImpose: null,
  clePhase: '',
});

const emettre = defineEmits<{ reessayer: []; revele: []; remasque: [] }>();

const etat = ref<EtatVoile>('masque');
const secondesMinutees = ref(0);
let minuterieExposition: ReturnType<typeof setTimeout> | null = null;
let minuterieCompte: ReturnType<typeof setInterval> | null = null;

const MS_PAR_SECONDE = 1000;

function arreterMinuteries(): void {
  if (minuterieExposition !== null) clearTimeout(minuterieExposition);
  if (minuterieCompte !== null) clearInterval(minuterieCompte);
  minuterieExposition = null;
  minuterieCompte = null;
}

function appliquer(evenement: Parameters<typeof transiter>[1]): void {
  const avant = etat.value;
  etat.value = props.etatImpose ?? transiter(avant, evenement);
  if (estRevele(avant) && !estRevele(etat.value)) emettre('remasque');
  if (!estRevele(avant) && estRevele(etat.value)) emettre('revele');
}

function remasquer(): void {
  arreterMinuteries();
  appliquer('remasquer');
}

/** Plafond absolu d'exposition : aucun chemin ne révèle plus longtemps (M2). */
function armerPlafond(dureeMs: number): void {
  arreterMinuteries();
  secondesMinutees.value = Math.ceil(dureeMs / MS_PAR_SECONDE);
  minuterieExposition = setTimeout(remasquer, dureeMs);
  minuterieCompte = setInterval(() => {
    secondesMinutees.value = Math.max(0, secondesMinutees.value - 1);
  }, MS_PAR_SECONDE);
}

function commencerMaintien(): void {
  if (!zoneActionnable(etat.value) || props.etatImpose !== null) return;
  appliquer('presser');
  appliquer('maintenir');
  armerPlafond(DUREES_MS['revelation-maintien-max']);
}

function revelationMinutee(): void {
  if (!zoneActionnable(etat.value) || props.etatImpose !== null) return;
  appliquer('contact_simple');
  armerPlafond(DUREES_MS['revelation-minutee']);
}

/** M3 : cinq causes de remasquage, un seul effet. */
onMounted(() => {
  etat.value = props.etatImpose ?? 'masque';
  globalThis.addEventListener('blur', remasquer);
  globalThis.addEventListener('scroll', remasquer, { passive: true });
  globalThis.document.addEventListener('visibilitychange', remasquer);
});

onBeforeUnmount(() => {
  arreterMinuteries();
  globalThis.removeEventListener('blur', remasquer);
  globalThis.removeEventListener('scroll', remasquer);
  globalThis.document.removeEventListener('visibilitychange', remasquer);
});

// Changement de phase ou d'état imposé : remasquage, sans exception.
watch(() => [props.clePhase, props.etatImpose], () => {
  arreterMinuteries();
  etat.value = props.etatImpose ?? 'masque';
});

const revele = computed(() => estRevele(etat.value));
const decompteMinute = computed(() => ({
  niveau: 'tension' as const,
  secondes: secondesMinutees.value,
  fraction: secondesMinutees.value / Math.max(1, Math.ceil(DUREES_MS['revelation-minutee'] / MS_PAR_SECONDE)),
}));
</script>

<template>
  <section
    class="voile"
    :class="[`voile--${props.variante}`, `voile--${etat}`]"
  >
    <header class="voile__entete">
      <h2 class="voile__intitule">
        {{ props.intitule }}
      </h2>
      <p class="voile__libelle">
        {{ texte(cleLibelle(etat)) }}
      </p>
    </header>

    <SqueletteChargement
      v-if="etat === 'chargement'"
      :lignes="1"
      hauteur="var(--gdv-secret-hauteur-fenetre)"
      :libelle="texte('voile.chargement')"
    />

    <!-- Fenêtre de lecture : 96 × 64, tiers inférieur, côté dominant (M4).
         Le contenu n'existe dans l'arbre que pendant la révélation (M1). -->
    <div
      v-else-if="revele"
      class="voile__fenetre"
      aria-live="assertive"
    >
      <slot name="secret" />
      <MinuteurPhase
        v-if="etat === 'revele_minute'"
        class="voile__compte"
        variante="barre"
        taille="md"
        :decompte="decompteMinute"
        :libelle="texte('voile.revelation_minutee')"
      />
    </div>

    <!-- État masqué : substitut sans valeur. Trois points médians, jamais un
         zéro ni une longueur qui renseignerait sur le nombre de chiffres. -->
    <p
      v-else-if="etat !== 'scelle' && etat !== 'desactive' && etat !== 'erreur'"
      class="voile__substitut"
      aria-hidden="true"
    >
      {{ texte('voile.substitut') }}
    </p>

    <slot
      v-if="revele"
      name="saisie"
    />

    <footer class="voile__pied">
      <button
        v-if="zoneActionnable(etat)"
        type="button"
        class="voile__zone"
        :aria-pressed="revele"
        :aria-describedby="`voile-aide-${props.variante}`"
        @pointerdown.prevent="commencerMaintien"
        @pointerup="remasquer"
        @pointerleave="remasquer"
        @pointercancel="remasquer"
        @keydown.space.prevent="commencerMaintien"
        @keyup.space.prevent="remasquer"
        @keydown.enter.prevent="revelationMinutee"
        @keydown.esc="remasquer"
      >
        {{ texte('voile.maintenir') }}
      </button>
      <p
        :id="`voile-aide-${props.variante}`"
        class="voile__aide"
      >
        {{ texte('voile.aide_clavier') }}
      </p>
      <slot name="reprise" />
    </footer>
  </section>
</template>

<style scoped>
.voile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-secret);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-secret-voile);
  box-shadow: var(--gdv-elevation-voile);
  color: var(--gdv-texte-sur-voile);
  inline-size: 100%;
}

.voile--pleine_page {
  min-block-size: 100%;
}

.voile__entete {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.voile__intitule {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
  line-height: var(--gdv-interligne-titre);
}

.voile__libelle {
  margin: 0;
  font-size: var(--gdv-role-etiquette);
}

/* Empreinte de lecture réduite : 96 × 64 sur 360 × 640 = 2,7 % de la surface,
   sous le plafond de 9 %. Ancrée du côté que la main occulte, inversable pour
   les gauchers par l'attribut data-cote-dominant de la racine. */
.voile__fenetre {
  align-self: flex-end;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  inline-size: var(--gdv-secret-largeur-fenetre);
  min-block-size: var(--gdv-secret-hauteur-fenetre);
  padding: var(--gdv-espacement-4);
  border-radius: var(--gdv-rayon-discret);
  background: var(--gdv-secret-voile);
  color: var(--gdv-texte-sur-voile);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
  /* Aucune animation d'apparition : elle allongerait la fenêtre d'exposition. */
  transition: none;
}

:global([data-cote-dominant='gauche']) .voile__fenetre {
  align-self: flex-start;
}

.voile__compte {
  inline-size: 100%;
}

/* Le substitut occupe la place du NOMBRE : il est composé dans la même famille
   et à la même largeur tabulaire, sans quoi l'empreinte de l'état masqué
   différerait de celle de l'état révélé et trahirait la bascule au voisin
   (M7-etat-masque-indiscernable). */
.voile__substitut {
  align-self: flex-end;
  margin: 0;
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
  letter-spacing: var(--gdv-espacement-4);
}

:global([data-cote-dominant='gauche']) .voile__substitut {
  align-self: flex-start;
}

.voile__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

/* La plus grande cible de l'écran, en bas, atteignable au pouce (Fitts). */
.voile__zone {
  min-block-size: var(--gdv-hauteur-zone-maintien-secret);
  inline-size: 100%;
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-secret);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-sur-voile);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-moyen);
  cursor: pointer;
  touch-action: none;
}

.voile__zone:active {
  background: var(--gdv-accent-action-actif);
  color: var(--gdv-texte-sur-accent);
}

.voile__zone:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.voile__aide {
  margin: 0;
  font-size: var(--gdv-role-meta);
}

.voile--desactive {
  border-color: var(--gdv-bordure-structurante);
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
}

.voile--erreur {
  border-color: var(--gdv-statut-avertissement);
}

/* M5 : état terminal. Surface claire, pastille PLEINE doublée du mot. */
.voile--scelle {
  border-width: var(--gdv-trait-fin);
  border-color: var(--gdv-bordure-structurante);
  background: var(--gdv-surface-secondaire);
  box-shadow: var(--gdv-elevation-plate);
  color: var(--gdv-texte-principal);
}

.voile--scelle .voile__libelle::before {
  content: '';
  display: inline-block;
  inline-size: var(--gdv-espacement-8);
  block-size: var(--gdv-espacement-8);
  margin-inline-end: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-statut-succes);
}
</style>
