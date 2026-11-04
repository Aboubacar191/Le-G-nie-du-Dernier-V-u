<script setup lang="ts">
// Aperçu d'avatar — reproduction fidèle du médaillon de l'écran B · Bienvenue
// du prototype (reference-prototype/b-bienvenue-premiere-ouverture.ecran.html) :
// un disque rempli de la couleur choisie, l'initiale du pseudo dessus.
//
// Rendu possible SANS enfreindre la règle « jamais de couleur de joueur comme
// fond de texte » parce que le texte qui le traverse n'est, par construction,
// PAS lié au thème : --gdv-avatar-texte-initiale porte la même valeur dans
// les deux thèmes (DESIGN-GDV-001.json, contraste_verifie.
// _note_couleurs_de_joueur, révisée). Les six couleurs sont mesurées contre
// cette seule valeur, pas contre texte-sur-accent qui, lui, change de thème.
//
// L'identité du joueur reste portée par le pseudo affiché en texte à côté
// (ChampTexteCourt juste en dessous dans les deux écrans appelants), jamais
// remplacé par ce médaillon — c'est la condition posée par le contrat pour
// accepter le risque de confusion deutéranope résiduel.

import { computed } from 'vue';

import { COULEURS_JOUEUR } from '../logique/couleurs-joueur.ts';
import { texte } from '../logique/contenu.ts';

interface Props {
  pseudo: string;
  couleurId: string;
  /** « apercu » (défaut) : écran Bienvenue. « mini » : en-tête de l'Accueil. */
  taille?: 'apercu' | 'mini';
}

const props = withDefaults(defineProps<Props>(), { taille: 'apercu' });

const couleur = computed(
  () => COULEURS_JOUEUR.find((c) => c.id === props.couleurId) ?? COULEURS_JOUEUR[0],
);

const initiale = computed(() => {
  const nom = props.pseudo.trim();
  return nom === '' ? '?' : nom.charAt(0).toUpperCase();
});
</script>

<template>
  <div
    class="avatar"
    role="img"
    :aria-label="texte('ecran.accueil.aria_apercu_avatar')"
  >
    <span
      class="avatar__medaillon"
      :class="{ 'avatar__medaillon--mini': props.taille === 'mini' }"
      :style="{ background: couleur?.hex }"
    >{{ initiale }}</span>
  </div>
</template>

<style scoped>
.avatar {
  display: flex;
  justify-content: center;
}

/* Dimensions relevées au prototype (composant.largeur/hauteur.avatar_apercu) :
   ni une cible tactile, ni une surface de contenu existante, donc un jeton de
   composant dédié plutôt qu'un emprunt approximatif à un autre rôle. */
.avatar__medaillon {
  display: grid;
  place-items: center;
  inline-size: var(--gdv-largeur-avatar-apercu);
  block-size: var(--gdv-hauteur-avatar-apercu);
  border-radius: var(--gdv-rayon-pilule);
  /* role-nombre-principal est écarté volontairement : la porte d'équipe lie
     ce rôle à famille.chiffres + largeur tabulaire (habillage-zafyr.test.ts),
     une contrainte pour des CHIFFRES alignés — pas pour une lettre. Le plus
     grand rôle NON numérique du contrat est titre-ecran ; c'est lui. */
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-ecran);
  font-weight: var(--gdv-graisse-tres-gras);
  color: var(--gdv-avatar-texte-initiale);
}

/* En-tête de C · Accueil : cible.minimale (déjà un jeton) est la dimension
   exacte relevée au prototype pour ce second usage — aucun jeton créé.
   role-titre-section y remplace titre-ecran pour la même raison que
   ci-dessus : le plus grand rôle non numérique qui reste sous la dimension
   du médaillon. */
.avatar__medaillon--mini {
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  font-size: var(--gdv-role-titre-section);
}
</style>
