<script setup lang="ts">
// BadgeLampe — la marque du jeu, et le SEUL élément purement décoratif que le
// contrat de conception autorise (DESIGN-GDV-001.json / iconographie.badge_lampe).
//
// PÉRIMÈTRE STRICT, et c'est une règle et non un goût : le badge n'apparaît que
// là où l'écran n'a rien de plus utile à montrer, c'est-à-dire ECR-01 Lancement
// et l'état de chargement de premier démarrage. Il est PROSCRIT des 30 écrans
// de jeu : à 360 px de large, le budget vertical appartient aux chiffres, et
// iconographie.interdits refuse tout glyphe de lampe sur un écran de jeu — la
// marque ne concurrence pas les chiffres. Le test habillage-zafyr.test.ts
// transforme cette phrase en porte.
//
// ACCESSIBILITÉ (iconographie.badge_lampe.accessibilite)
// Le badge porte le NOM DU JEU en texte alternatif, et non « Lampe du génie »
// comme le fait le prototype : il sert de marque, pas d'illustration. Quand un
// h1 répète ce nom en texte réel dans le même bloc, le badge est marqué
// aria-hidden pour ne pas l'annoncer deux fois. L'appelant le DÉCLARE par
// `titre-adjacent` : la valeur n'est pas devinée ici, parce que seul l'écran
// sait s'il porte un h1.
//
// Les trois pastilles sont DÉCORATIVES dans le prototype et le restent : elles
// ne numérotent aucune étape, donc aria-hidden obligatoire, faute de quoi un
// lecteur d'écran annonce une progression qui n'existe pas.
//
// Aucune animation du glyphe : iconographie.badge_lampe.accessibilite.mouvement
// n'en autorise aucune par défaut.

import { texte } from '../logique/contenu.ts';

interface Props {
  /**
   * Vrai lorsqu'un h1 portant le nom du jeu suit le badge dans le même bloc.
   * Aucune valeur par défaut : la décision appartient à l'écran appelant.
   */
  titreAdjacent: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <div
    class="badge"
    :aria-hidden="props.titreAdjacent ? 'true' : undefined"
    :role="props.titreAdjacent ? undefined : 'img'"
    :aria-label="props.titreAdjacent ? undefined : texte('commun.titre_application')"
  >
    <div class="badge__medaillon">
      <!-- Zone de dessin 150 × 150 relevée au prototype. Aucune couleur n'est
           écrite dans le tracé : chaque groupe hérite de currentColor, posé par
           un jeton dans la feuille de style ci-dessous, pour que la bascule
           clair / sombre ne casse pas. -->
      <svg
        class="badge__glyphe"
        viewBox="0 0 150 150"
        aria-hidden="true"
        focusable="false"
      >
        <!-- Fumée : décorative, exemptée de tout seuil de contraste. -->
        <g class="badge__fumee">
          <path
            d="M78 70c-8-10 2-18-4-28-4-7 2-14 9-16-4 7 2 11 0 19-2 8 6 12 2 20"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
          />
          <path
            class="badge__fumee--secondaire"
            d="M84 40c6 2 10 8 8 14"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
          />
        </g>

        <!-- Lampe : tracé porteur de sens, mesuré à 9,94:1 en sombre et
             6,54:1 en clair sur surface-primaire. -->
        <g class="badge__lampe">
          <path
            class="badge__corps"
            d="M30 98c-2-14 12-24 34-24s36 10 34 24"
            stroke="currentColor"
            stroke-linejoin="round"
          />
          <path
            d="M30 98c10 10 60 12 78 0l20-16c4-3 9-1 9 3-2 6-10 9-16 12"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M30 98c-10-2-16-8-14-14 6 0 12 4 14 14z"
            fill="none"
            stroke="currentColor"
            stroke-linejoin="round"
          />
          <path
            d="M56 74c0-6 4-10 8-10s8 4 8 10"
            fill="none"
            stroke="currentColor"
          />
          <path
            d="M48 116h44M56 108l-4 8M84 108l4 8"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
          />
        </g>
      </svg>
    </div>

    <!-- Décoratives : aucune étape n'est numérotée ici. -->
    <div
      class="badge__pastilles"
      aria-hidden="true"
    >
      <span class="badge__pastille badge__pastille--une" />
      <span class="badge__pastille badge__pastille--deux" />
      <span class="badge__pastille badge__pastille--trois" />
    </div>
  </div>
</template>

<style scoped>
.badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-16);
}

/* Médaillon : 192 px, soit 0,59 de la largeur utile à 360 px — la proportion
   du prototype, qui dessine 220 px sur 390 px, en rendant du budget vertical. */
.badge__medaillon {
  display: grid;
  place-items: center;
  inline-size: var(--gdv-largeur-badge-lampe);
  block-size: var(--gdv-hauteur-badge-lampe);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-primaire);
}

.badge__glyphe {
  inline-size: var(--gdv-largeur-glyphe-lampe);
  block-size: var(--gdv-largeur-glyphe-lampe);
}

.badge__lampe {
  color: var(--gdv-accent-action);
  stroke-width: var(--gdv-trait-epais);
}

/* Le corps de la lampe est un or très assombri dans le prototype. Il est
   exprimé ici en marque-prive à faible opacité (valeur du contrat :
   iconographie.badge_lampe.glyphe.remplissage_corps_opacite) pour qu'il reste
   juste au thème clair au lieu d'y former une tache sombre. */
.badge__corps {
  fill: var(--gdv-marque-prive);
  fill-opacity: 0.18;
}

/* Les 2,5 px du prototype sont ramenés à trait.moyen : seules 1, 2 et 3 px
   sont des épaisseurs autorisées (tokens.trait). */
.badge__fumee {
  color: var(--gdv-texte-secondaire);
  stroke-width: var(--gdv-trait-moyen);
}

.badge__fumee--secondaire {
  opacity: 0.6;
}

.badge__pastilles {
  display: flex;
  gap: var(--gdv-espacement-8);
}

.badge__pastille {
  inline-size: var(--gdv-espacement-8);
  block-size: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
}

.badge__pastille--une {
  background: var(--gdv-accent-action);
}

.badge__pastille--deux {
  background: var(--gdv-bordure-secret);
}

.badge__pastille--trois {
  background: var(--gdv-bordure-structurante);
}
</style>
