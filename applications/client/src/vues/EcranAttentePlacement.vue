<script setup lang="ts">
// ECR-08 — Attente du placement, vue marchand.
//
// Faire attendre sans laisser croire à un blocage, et permettre à CHACUN de
// vérifier son cercle. C'est le seul garde-fou contre un cercle faux, et il
// coûte un contact par joueur.
//
// Les relations de voisinage sont annoncées TEXTUELLEMENT, en plus de la
// position graphique : l'information de voisinage n'est jamais portée par la
// seule position.
//
// ÉTATS (DESIGN ECR-08)
// chargement   : cercle en squelette, aucune position devinée.
// contenu      : MA carte en bas, « À ta gauche X », « À ta droite Y », et les
//                deux boutons de vérification.
// vide         : ordre pas encore saisi — l'attente est remplie d'une consigne
//                UTILE (regarde qui est assis à côté de toi), pas d'un
//                tourniquet.
// erreur       : ordre incohérent reçu, avec un bouton pour prévenir l'hôte.
// acces_refuse : jeton invalide, redirection vers ECR-32 par le magasin.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import EtatVide from '../composants/EtatVide.vue';
import IndicateurConnexion from '../composants/IndicateurConnexion.vue';
import { texte } from '../logique/contenu.ts';
import { voisinDeDroite, voisinDeGauche } from '../logique/positions-cercle.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const confirme = ref(false);
const signale = ref(false);

const moi = computed(() => magasin.etat.moi?.joueur_id ?? '');
const ordre = computed(() => magasin.etat.ordre_cercle);
const ordreRecu = computed(() => ordre.value.length > 0);

const gauche = computed(() => {
  const voisin = voisinDeGauche([...ordre.value], moi.value);
  return voisin === null ? '' : pseudoDe(magasin.etat, voisin);
});
const droite = computed(() => {
  const voisin = voisinDeDroite([...ordre.value], moi.value);
  return voisin === null ? '' : pseudoDe(magasin.etat, voisin);
});
</script>

<template>
  <main class="attente-placement">
    <header class="attente-placement__entete">
      <h1 class="attente-placement__titre">
        {{ texte('ecran.attente_placement.titre') }}
      </h1>
      <IndicateurConnexion :liaison="magasin.etat.liaison" />
    </header>

    <BandeauAlerte
      v-if="magasin.etat.liaison === 'perdue'"
      variante="avertissement"
      cle-contenu="connexion.peut_etre_perime"
    />
    <BandeauAlerte
      v-if="signale"
      variante="information"
      cle-contenu="ecran.attente_placement.signale"
      @expirer="signale = false"
    />
    <BandeauAlerte
      v-if="confirme"
      variante="succes"
      cle-contenu="ecran.attente_placement.confirme"
      @expirer="confirme = false"
    />

    <EtatVide
      v-if="!ordreRecu"
      :titre="texte('ecran.attente_placement.attente')"
      :progression="texte('cercle.sens_horaire')"
    />

    <template v-else>
      <CercleDesPlaces
        :joueurs="magasin.etat.joueurs"
        :ordre="[...ordre]"
        :moi="moi"
        variante="lecture"
      />

      <!-- Relations de voisinage en clair : une révélation de voisinage doit
           être compréhensible sans interpréter un dessin. -->
      <ul class="attente-placement__voisins">
        <li>{{ texte('cercle.a_ta_gauche') }} : {{ gauche }}</li>
        <li>{{ texte('cercle.a_ta_droite') }} : {{ droite }}</li>
      </ul>

      <footer class="attente-placement__pied">
        <BoutonAction
          :libelle="texte('ecran.attente_placement.place_juste')"
          variante="principal"
          taille="lg"
          pleine-largeur
          @agir="confirme = true"
        />
        <BoutonAction
          :libelle="texte('ecran.attente_placement.place_fausse')"
          variante="secondaire"
          taille="md"
          @agir="signale = true"
        />
      </footer>
    </template>
  </main>
</template>

<style scoped>
.attente-placement {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.attente-placement__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.attente-placement__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.attente-placement__voisins {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--gdv-role-corps);
}

.attente-placement__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}
</style>
