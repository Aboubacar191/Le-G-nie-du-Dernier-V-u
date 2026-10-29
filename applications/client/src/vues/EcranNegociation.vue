<script setup lang="ts">
// ECR-12 — Négociation. 120 s, US-12.
//
// La négociation est ORALE. L'application n'est ici qu'un REGISTRE de
// transferts et de prêts : il n'y a pas de messagerie, et la bulle du génie dit
// explicitement que l'action attendue est la conversation.
//
// ANTI-FUITE : le bouton « Proposer un prêt » n'existe que chez le PRETEUR
// (RG-29), et un voisin pourrait en déduire le rôle. Mitigation retenue par le
// contrat de conception : il est placé DANS la feuille de transfert, en seconde
// option, et jamais sur l'écran de fond. L'écran au repos est donc identique
// pour tous.
//
// ÉTATS (DESIGN ECR-12)
// chargement   : cercle en squelette, bandeau de phase déjà actif.
// contenu      : cercle au centre, pastille de solde en haut, un bouton
//                principal en pied, bulle en état vide.
// vide         : aucun transfert reçu ni émis — nominal. L'état vide vit dans
//                la feuille, pas sur l'écran.
// erreur       : transfert refusé. Le solde est cité DANS la feuille voilée,
//                jamais dans le bandeau public (M6).
// acces_refuse : non-PRETEUR tentant un prêt — l'échec propose l'action
//                équivalente autorisée, le transfert simple.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import EcranPropositionPret from './EcranPropositionPret.vue';
import EcranTransfert from './EcranTransfert.vue';

const magasin = utiliserMagasin();

const feuilleTransfert = ref(false);
const feuillePret = ref(false);

const hote = computed(() => magasin.etat.moi?.est_hote === true);
/** Le rôle n'est connu que de son porteur : la condition est locale et privée. */
const preteur = computed(() => magasin.etat.moi?.role_secret === 'PRETEUR');
</script>

<template>
  <section class="negociation">
    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <CercleDesPlaces
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="magasin.etat.moi?.joueur_id ?? ''"
      variante="lecture"
      :declarations="magasin.etat.declarations"
    >
      <template #centre>
        <!-- L'état vide renvoie explicitement à la conversation orale, qui EST
             l'action attendue. Ce n'est pas un trou, c'est une consigne. -->
        <BulleGenie
          variante="annonce"
          etat="vide"
          cle-vide="genie.se_tait_a_vous"
        />
      </template>
    </CercleDesPlaces>

    <footer class="negociation__pied">
      <BoutonAction
        :libelle="texte('ecran.negociation.transferer')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="feuilleTransfert = true"
      />

      <!-- Seule commande d'avance de phase autorisée, et seulement en
           NEGOCIATION. En variante secondaire et en pied, loin de l'action
           courante : une avance accidentelle coûterait 120 s à huit personnes. -->
      <BoutonAction
        v-if="hote"
        :libelle="texte('ecran.negociation.passer_suite')"
        variante="secondaire"
        taille="md"
        @agir="magasin.envoyer('avancer_phase')"
      />
    </footer>

    <EcranTransfert
      v-if="feuilleTransfert"
      :preteur="preteur"
      @fermer="feuilleTransfert = false"
      @proposer-pret="feuilleTransfert = false; feuillePret = true"
    />

    <EcranPropositionPret
      v-if="feuillePret"
      @fermer="feuillePret = false"
    />
  </section>
</template>

<style scoped>
.negociation {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.negociation__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}
</style>
