<script setup lang="ts">
// Représentation du temps restant. TROIS canaux redondants : le nombre de
// secondes, la longueur de l'arc, et le jeton de couleur. Jamais la couleur
// seule.
//
// Le fichier s'appelle MinuteurPhase et non Minuteur pour la règle
// vue/multi-word-component-names, qui fait partie de la porte de lint. Le rôle
// est celui du composant « Minuteur » du contrat.
//
// L'arc est dérivé de phase_fin_at CORRIGÉ du décalage d'horloge (RG-79) : le
// parent passe un Decompte déjà calculé, ce composant ne lit aucune horloge.
// Il ne pilote rien non plus : l'autorité de l'expiration est au serveur (RG-72).

import { formaterDecompte, type Decompte } from '../logique/decompte.ts';

export type VarianteMinuteur = 'anneau' | 'barre';

interface Props {
  decompte: Decompte;
  variante?: VarianteMinuteur;
  taille?: 'md' | 'lg';
  /** Durée totale de la phase, pour aria-valuemax. */
  dureePhaseS?: number | null;
  /** Barre indéterminée : attente sans échéance connue. */
  indeterminee?: boolean;
  libelle: string;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'anneau',
  taille: 'md',
  dureePhaseS: null,
  indeterminee: false,
});

// Périmètre d'un cercle de rayon 1, exprimé en unités de tracé SVG. Le tracé
// est en coordonnées normalisées : aucune dimension en pixels n'entre ici.
const RAYON = 15.9155;
const PERIMETRE = 100;

const longueurArc = (): number => Math.round(props.decompte.fraction * PERIMETRE);
</script>

<template>
  <div
    class="minuteur"
    :class="[`minuteur--${props.variante}`, `minuteur--${props.taille}`, `minuteur--${props.decompte.niveau}`]"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="props.dureePhaseS ?? undefined"
    :aria-valuenow="props.decompte.secondes ?? undefined"
    :aria-valuetext="libelle"
  >
    <svg
      v-if="props.variante === 'anneau'"
      class="minuteur__anneau"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <circle
        class="minuteur__rail"
        cx="18"
        cy="18"
        :r="RAYON"
        fill="none"
      />
      <circle
        class="minuteur__arc"
        cx="18"
        cy="18"
        :r="RAYON"
        fill="none"
        :stroke-dasharray="`${longueurArc()} ${PERIMETRE}`"
        transform="rotate(-90 18 18)"
      />
    </svg>
    <div
      v-else
      class="minuteur__piste"
      aria-hidden="true"
    >
      <div
        class="minuteur__remplissage"
        :class="{ 'minuteur__remplissage--indeterminee': props.indeterminee }"
        :style="props.indeterminee ? undefined : { inlineSize: `${longueurArc()}%` }"
      />
    </div>
    <span class="minuteur__nombre">{{ formaterDecompte(props.decompte.secondes) }}</span>
  </div>
</template>

<style scoped>
.minuteur {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gdv-urgence-calme);
}

.minuteur--md {
  inline-size: var(--gdv-largeur-anneau-minuteur);
  min-block-size: var(--gdv-largeur-anneau-minuteur);
}

.minuteur--lg {
  inline-size: var(--gdv-cible-confortable);
  min-block-size: var(--gdv-cible-confortable);
}

.minuteur--barre {
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  inline-size: 100%;
}

/* Les trois niveaux d'urgence. La couleur est le TROISIÈME canal : le nombre et
   la longueur d'arc portent déjà l'information. */
.minuteur--calme {
  color: var(--gdv-urgence-calme);
}

.minuteur--tension {
  color: var(--gdv-urgence-tension);
}

.minuteur--critique,
.minuteur--expire {
  color: var(--gdv-urgence-critique);
  font-weight: var(--gdv-graisse-gras);
}

.minuteur--chargement {
  color: var(--gdv-texte-desactive);
}

.minuteur__anneau {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
}

.minuteur__rail {
  stroke: var(--gdv-surface-secondaire);
  stroke-width: var(--gdv-trait-epais);
}

.minuteur__arc {
  stroke: currentcolor;
  stroke-width: var(--gdv-trait-epais);
  stroke-linecap: butt;
  transition: stroke-dasharray var(--gdv-duree-rapide) var(--gdv-courbe-standard);
}

.minuteur__piste {
  inline-size: 100%;
  block-size: var(--gdv-trait-epais);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-secondaire);
  overflow: hidden;
}

.minuteur__remplissage {
  block-size: 100%;
  background: currentcolor;
  transition: inline-size var(--gdv-duree-rapide) var(--gdv-courbe-standard);
}

.minuteur__remplissage--indeterminee {
  inline-size: 100%;
  animation: va_et_vient var(--gdv-duree-lente) var(--gdv-courbe-standard) infinite alternate;
}

.minuteur__nombre {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-minuteur);
  font-variant-numeric: var(--gdv-chiffres-variant);
  line-height: var(--gdv-interligne-titre);
}

.minuteur--md .minuteur__nombre,
.minuteur--barre .minuteur__nombre {
  font-size: var(--gdv-role-corps);
}

@keyframes va_et_vient {
  from {
    transform: scaleX(0.2);
  }

  to {
    transform: scaleX(1);
  }
}
</style>
