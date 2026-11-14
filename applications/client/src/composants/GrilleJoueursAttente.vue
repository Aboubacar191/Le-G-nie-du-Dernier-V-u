<script setup lang="ts">
// Grille des marchands connectés — écran 1 · Salle d'attente du prototype.
// Numéro = ordre d'ARRIVÉE dans la liste, jamais position_cercle (NUL avant
// PLACEMENT — RG-06) : aucune donnée inventée, juste l'index d'affichage
// d'une liste déjà projetée par le serveur dans cet ordre.
//
// Extrait de vues/EcranSalleAttente.vue (porte de lint max-lines) : purement
// présentationnel.

import { texte } from '../logique/contenu.ts';

interface JoueurAffiche {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly connecte: boolean;
}

interface Props {
  joueurs: readonly JoueurAffiche[];
  moiId: string;
  hote: boolean;
  n: number;
  max: number;
}

const props = defineProps<Props>();
</script>

<template>
  <div class="grille">
    <div class="grille__entete">
      <h2 class="grille__titre">
        {{ texte('ecran.salle_attente.marchands_titre') }}
      </h2>
      <span class="grille__compte">
        {{ texte('ecran.salle_attente.marchands_compte', { n: props.n, max: props.max }) }}
      </span>
    </div>
    <p class="grille__ordre">
      {{ texte('ecran.salle_attente.ordre_places') }}
    </p>

    <ol class="grille__liste">
      <li
        v-for="(joueur, index) in props.joueurs"
        :key="joueur.joueur_id"
      >
        <div
          class="grille__carte"
          :class="{
            'grille__carte--moi': joueur.joueur_id === props.moiId,
            'grille__carte--deconnecte': !joueur.connecte,
          }"
        >
          <span
            class="grille__numero"
            aria-hidden="true"
          >{{ index + 1 }}</span>
          <span class="grille__pseudo">
            {{ joueur.joueur_id === props.moiId
              ? texte(props.hote ? 'ecran.salle_attente.moi_hote' : 'ecran.salle_attente.moi')
              : joueur.pseudo }}
          </span>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* Scroll interne SCOPÉ à la liste (conseil LLM, 2026-11-14 — « RUP responsive ») :
   UNE tentative par chaîne de flex-shrink (.grille en min-block-size: 0,
   rétréci par le parent .attente) a été essayée et rejetée — vérifié par
   mesure : un min-block-size: 0 explicite sur un flex ITEM fixe sa taille
   plancher à 0 pour de bon auprès du PARENT, qui l'y pousse dès qu'il y a la
   moindre pression, sans jamais consulter les planchers des enfants de cet
   item. Toute la liste disparaissait plutôt que de défiler. La voie retenue
   ne participe PAS à ce bras de fer : .grille__liste plafonne SA PROPRE
   hauteur en valeur absolue (max-block-size), indépendamment du reste de
   l'écran — moins élégant qu'un calcul dynamique exact, mais robuste : il ne
   peut pas s'effondrer à zéro quelle que soit la pression des voisins. */
.grille {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.grille__entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.grille__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.grille__compte {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.grille__ordre {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.grille__liste {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  /* Plafond relatif au VIEWPORT, pas une part du budget des voisins (qui
     s'effondre à zéro, voir le commentaire de .grille) ni un nombre de
     rangées fixe (pénaliserait les téléphones assez hauts pour tout
     montrer sans défiler). 33dvh ≈ 2 rangées sur un petit écran (iPhone SE,
     ne défile donc plus que pour 5 marchands et plus), ≈ 4-5 rangées sur un
     écran haut (iPhone 14 Pro Max) — mesuré pour les deux. */
  max-block-size: 33dvh;
  overflow-y: auto;
  list-style: none;
}

.grille__carte {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-8);
  min-block-size: var(--gdv-cible-minimale);
  padding-inline: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
}

.grille__carte--moi {
  border-color: var(--gdv-accent-action);
}

.grille__carte--deconnecte {
  border-style: dashed;
  color: var(--gdv-texte-secondaire);
}

.grille__numero {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--gdv-taille-24);
  block-size: var(--gdv-taille-24);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-gras);
}

.grille__carte--moi .grille__numero {
  background: var(--gdv-accent-action);
  color: var(--gdv-texte-sur-accent);
}

.grille__pseudo {
  overflow: hidden;
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-moyen);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
