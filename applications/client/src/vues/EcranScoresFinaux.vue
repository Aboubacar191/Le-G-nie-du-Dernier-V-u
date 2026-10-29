<script setup lang="ts">
// ECR-27 — Scores finaux (US-15, RG-55 à RG-58, CA-40, CA-41).
//
// Classer, désigner le vainqueur, et tout révéler. C'est le SEUL moment où les
// secrets sortent, donc le seul écran sans aucun voile.
//
// DEUX exclusions permanentes subsistent malgré RG-58, et c'est la
// matrice_visibilite qui prime (CONF-04) : l'identité du porteur de la clause
// et l'existence des enquêtes ne figurent nulle part sur cet écran, et le
// protocole ne les transporte d'ailleurs pas.
//
// ÉTATS (DESIGN ECR-27)
// chargement   : squelette de nb_joueurs lignes.
// contenu      : classement décroissant, ligne du vainqueur distinguée par la
//                surface, la bordure ET un badge textuel. Sections dévoilables.
// vide         : partie terminée sans manche jouée.
// erreur       : scores non reçus. Aucun score partiel : un classement faux est
//                pire qu'un classement absent.
// acces_refuse : jeton expiré après la fin de partie — cette partie est close.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import TableauScores from '../composants/TableauScores.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const scores = computed(() => magasin.etat.scores);
const hote = computed(() => magasin.etat.moi?.est_hote === true);
const modeAvance = computed(() => magasin.etat.session?.mode_avance_actif === true);

function rejouer(): void {
  // RG-59 : rejouer avec le même groupe crée une NOUVELLE session. Le jeton de
  // groupe persiste sur l'appareil de l'hôte et porte le compteur.
  magasin.naviguer('creation');
}
</script>

<template>
  <main class="scores">
    <h1 class="scores__titre">
      {{ texte('scores.titre') }}
    </h1>

    <TableauScores
      :classement="scores?.classement ?? []"
      :vainqueurs="scores?.vainqueurs ?? []"
      :paiements-historiques="scores?.paiements_historiques ?? []"
      :genie-libere="scores?.genie_libere ?? false"
      :victoire-par-liberation="scores?.victoire_par_liberation ?? false"
      :mode-avance="modeAvance"
      :chargement="scores === null"
      @rejouer="rejouer"
    />

    <footer class="scores__pied">
      <BoutonAction
        v-if="hote"
        :libelle="texte('scores.rejouer')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="rejouer"
      />
      <p
        v-else
        class="scores__attente"
      >
        {{ texte('scores.attendre_relance') }}
      </p>

      <BoutonAction
        :libelle="texte('scores.quitter')"
        variante="discret"
        taille="md"
        @agir="magasin.quitter()"
      />
    </footer>
  </main>
</template>

<style scoped>
.scores {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.scores__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.scores__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}

.scores__attente {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
}
</style>
