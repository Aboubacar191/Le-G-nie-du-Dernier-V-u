<script setup lang="ts">
// ECR-07 — Placement du cercle, vue hôte (US-03, RG-06, CA-04).
//
// C'est l'écran dont dépend tout le gabarit VOISINAGE : un ordre faux produit
// des révélations VRAIES mais incompréhensibles. Il ne se devine pas.
//
// Méthode retenue : DÉSIGNATION SÉQUENTIELLE. L'hôte touche un joueur, il
// s'assoit au siège courant, le siège suivant s'active. Un contact par siège,
// aucun glissement. Le glisser-déposer a été écarté d'emblée : plus coûteux,
// fragile au tactile, inutilisable au clavier, et plus lent (deux gestes par
// joueur contre un contact).
//
// Le SENS de rotation est affiché en permanence, et un bouton l'inverse sans
// tout refaire.
//
// ÉTATS (DESIGN ECR-07)
// chargement   : liste des joueurs en squelette, cercle déjà tracé avec le bon
//                nombre de sièges vides.
// contenu      : sièges numérotés, joueurs non placés dessous, compteur
//                « k sur n places fixées », validation désactivée avec raison.
// vide         : aucun joueur placé — « Commence par toi », action « Me placer
//                en premier » qui assoit l'hôte au siège 1.
// erreur       : permutation incomplète, le message NOMME qui manque ; refus
//                serveur, rien n'est perdu.
// acces_refuse : non-hôte — seul l'hôte fixe les places, sortie vers ECR-08.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import CarteJoueurCercle from '../composants/CarteJoueurCercle.vue';
import EtatVide from '../composants/EtatVide.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { inverserSens, ordreEstValide } from '../logique/positions-cercle.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const assis = ref<string[]>([]);

const joueurs = computed(() => magasin.etat.joueurs);
const chargement = computed(() => joueurs.value.length === 0);
const restants = computed(() =>
  joueurs.value.filter((joueur) => !assis.value.includes(joueur.joueur_id)),
);
const complet = computed(() =>
  ordreEstValide(assis.value, joueurs.value.map((joueur) => joueur.joueur_id)),
);

const raisonValidation = computed(() =>
  texte('ecran.placement.valider_desactive', { n: restants.value.length }),
);

const premierManquant = computed(() => restants.value[0]?.pseudo ?? '');

function asseoir(joueurId: string): void {
  if (assis.value.includes(joueurId)) {
    // Toucher un joueur déjà placé le RETIRE et réactive son siège.
    assis.value = assis.value.filter((identifiant) => identifiant !== joueurId);
    return;
  }
  assis.value = [...assis.value, joueurId];
}

function mePlacerEnPremier(): void {
  const moi = magasin.etat.moi?.joueur_id;
  if (moi === undefined) return;
  assis.value = [moi];
}

function valider(): void {
  magasin.envoyer('definir_ordre_places', { ordre: assis.value });
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

    <p class="placement__compteur">
      {{ texte('ecran.placement.compteur', { k: assis.length, n: joueurs.length }) }}
    </p>

    <SqueletteChargement
      v-if="chargement"
      :lignes="5"
      hauteur="var(--gdv-hauteur-carte-joueur)"
      :libelle="texte('commun.chargement')"
    />

    <template v-else>
      <EtatVide
        v-if="assis.length === 0"
        :titre="texte('ecran.placement.consigne')"
        :action-libelle="texte('ecran.placement.me_placer')"
        @agir="mePlacerEnPremier"
      />

      <!-- Sièges déjà fixés : liste ORDONNÉE, l'ordre du DOM est l'ordre du
           cercle, donc l'ordre de tabulation est l'ordre physique. -->
      <ol
        v-else
        class="placement__sieges"
      >
        <li
          v-for="(joueurId, index) in assis"
          :key="joueurId"
          class="placement__siege"
        >
          <p class="placement__numero">
            {{ texte('cercle.siege', { numero: index + 1 }) }}
          </p>
          <CarteJoueurCercle
            :pseudo="joueurs.find((j) => j.joueur_id === joueurId)?.pseudo ?? joueurId"
            :position-cercle="index + 1"
            :connecte="joueurs.find((j) => j.joueur_id === joueurId)?.connecte ?? false"
            :relation="joueurId === magasin.etat.moi?.joueur_id ? 'moi' : 'en_face'"
            variante="selectionnable"
            selectionnee
            @choisir="asseoir(joueurId)"
          />
        </li>
      </ol>

      <section
        v-if="restants.length > 0"
        class="placement__restants"
      >
        <h2 class="placement__sous-titre">
          {{ texte('ecran.placement.non_places') }}
        </h2>
        <p class="placement__indice">
          {{ texte('ecran.placement.manque_nomme', { pseudo: premierManquant }) }}
        </p>
        <ul class="placement__liste">
          <li
            v-for="joueur in restants"
            :key="joueur.joueur_id"
          >
            <!-- RG-46 : un joueur déconnecté reste PLAÇABLE, il n'est pas éliminé. -->
            <CarteJoueurCercle
              :pseudo="joueur.pseudo"
              :position-cercle="joueur.position_cercle"
              :connecte="joueur.connecte"
              :relation="joueur.joueur_id === magasin.etat.moi?.joueur_id ? 'moi' : 'en_face'"
              variante="selectionnable"
              @choisir="asseoir(joueur.joueur_id)"
            />
          </li>
        </ul>
      </section>
    </template>

    <footer class="placement__pied">
      <div class="placement__corrections">
        <BoutonAction
          :libelle="texte('ecran.placement.defaire')"
          variante="secondaire"
          taille="md"
          :desactive="assis.length === 0"
          :raison="texte('ecran.placement.consigne')"
          @agir="assis = assis.slice(0, -1)"
        />
        <BoutonAction
          :libelle="texte('cercle.sens_inverse')"
          variante="secondaire"
          taille="md"
          :desactive="assis.length < 3"
          :raison="texte('ecran.placement.consigne')"
          @agir="assis = [...inverserSens(assis)]"
        />
        <BoutonAction
          :libelle="texte('ecran.placement.tout_recommencer')"
          variante="discret"
          taille="md"
          @agir="assis = []"
        />
      </div>

      <BoutonAction
        :libelle="texte('ecran.placement.valider')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="!complet"
        :raison="raisonValidation"
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
  min-block-size: 100vh;
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

.placement__compteur {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.placement__sieges,
.placement__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.placement__siege {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
}

.placement__numero {
  margin: 0;
  min-inline-size: var(--gdv-cible-confortable);
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-etiquette);
}

.placement__restants {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.placement__sous-titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.placement__indice {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
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
