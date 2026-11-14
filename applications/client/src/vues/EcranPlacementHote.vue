<script setup lang="ts">
// ECR-07 — Placement du cercle, vue hôte (US-03, RG-06, CA-04).
//
// C'est l'écran dont dépend tout le gabarit VOISINAGE : un ordre faux produit
// des révélations VRAIES mais incompréhensibles. Il ne se devine pas.
//
// MÉTHODE — fidélité à la maquette (écran 1 · Salle d'attente, « Glisse pour
// réordonner »), sur arbitrage explicite du 2026-11-10. L'ancienne méthode
// (désignation séquentielle, un contact par siège) avait écarté le
// glisser-déposer pour deux reproches précis ; ReordonneurJoueurs.vue les
// adresse plutôt que de les contourner : le geste est porté par POINTER
// EVENTS (fiable au tactile, contrairement à l'API HTML5 Drag and Drop), et
// chaque ligne porte EN PLUS deux boutons Monter/Descendre TOUJOURS visibles,
// pour le clavier et pour qui ne veut pas glisser.
//
// Les joueurs sont TOUS déjà en liste dès l'arrivée sur cet écran (ordre
// d'arrivée par défaut) : il n'y a plus d'étape « asseoir un par un », donc
// plus d'état incomplet à valider — l'ordre est une permutation complète par
// construction, à chaque instant.
//
// Le SENS de rotation est affiché en permanence, et un bouton l'inverse sans
// tout refaire.
//
// ÉTATS (DESIGN ECR-07)
// chargement   : liste en squelette, aux dimensions des lignes.
// contenu      : liste réordonnable complète, bouton de validation TOUJOURS
//                actif.
// vide         : non atteignable — l'hôte seul suffit à peupler la liste.
// erreur       : refus serveur (ORDRE_PLACES_INVALIDE), rien n'est perdu :
//                l'ordre local reste affiché, inchangé.
// acces_refuse : non-hôte — seul l'hôte fixe les places, sortie vers ECR-08.

import { ref, watch } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import ReordonneurJoueurs from '../composants/ReordonneurJoueurs.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { inverserSens } from '../logique/positions-cercle.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const ordre = ref<string[]>([]);
const envoi = ref(false);

// Semé UNE FOIS depuis l'ordre d'arrivée, jamais réécrit tant qu'un ordre
// local existe : un joueur qui se déconnecte pendant le placement ne doit pas
// faire sauter la liste sous le pouce de l'hôte (RG-46, il reste plaçable).
watch(
  () => magasin.etat.joueurs,
  (joueurs) => {
    if (ordre.value.length === 0 && joueurs.length > 0) {
      ordre.value = joueurs.map((joueur) => joueur.joueur_id);
    }
  },
  { immediate: true },
);

const chargement = () => ordre.value.length === 0;

function retablirOrdreArrivee(): void {
  ordre.value = magasin.etat.joueurs.map((joueur) => joueur.joueur_id);
}

function valider(): void {
  envoi.value = true;
  magasin.envoyer('definir_ordre_places', { ordre: ordre.value });
  envoi.value = false;
}
</script>

<template>
  <main class="placement">
    <h1 class="placement__titre">
      {{ texte('ecran.placement.titre') }}
    </h1>

    <!-- Le sens n'est jamais deviné : il est écrit, en permanence. -->
    <p class="placement__sens">
      {{ texte('cercle.sens_horaire') }}
    </p>

    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <SqueletteChargement
      v-if="chargement()"
      :lignes="5"
      hauteur="var(--gdv-cible-geante)"
      :libelle="texte('commun.chargement')"
    />

    <!-- L'ordre du DOM est l'ordre du cercle : l'ordre de tabulation suit
         donc l'ordre physique, glissé ou non. -->
    <ReordonneurJoueurs
      v-else
      :joueurs="magasin.etat.joueurs"
      :moi-id="magasin.etat.moi?.joueur_id ?? ''"
      :ordre="ordre"
      @update:ordre="ordre = $event"
    />

    <footer class="placement__pied">
      <div class="placement__corrections">
        <BoutonAction
          :libelle="texte('cercle.sens_inverse')"
          variante="secondaire"
          taille="md"
          :desactive="ordre.length < 3"
          @agir="ordre = [...inverserSens(ordre)]"
        />
        <BoutonAction
          :libelle="texte('ecran.placement.retablir_arrivee')"
          variante="discret"
          taille="md"
          @agir="retablirOrdreArrivee"
        />
      </div>

      <BoutonAction
        :libelle="texte('ecran.placement.valider')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :chargement="envoi"
        @agir="valider"
      />
    </footer>
  </main>
</template>

<style scoped>
.placement {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.placement__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.placement__sens {
  margin: 0;
  padding: var(--gdv-espacement-8);
  border-inline-start: var(--gdv-trait-epais) solid var(--gdv-statut-info);
  background: var(--gdv-surface-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.placement__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}

.placement__corrections {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-12);
}
</style>
