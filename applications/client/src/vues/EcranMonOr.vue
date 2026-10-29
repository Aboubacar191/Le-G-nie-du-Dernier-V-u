<script setup lang="ts">
// ECR-28 — Mon or, panneau privé. Surface SUPERPOSÉE, accessible depuis TOUTE
// phase (US-13, CA-36, RG-42).
//
// Données strictement privées. Le MOTIF de chaque mouvement est en clair — il
// ne chiffre rien — et le DELTA est sous voile. Le joueur relit la nature de
// ses mouvements d'un coup d'œil sans exposer un seul chiffre.
//
// La feuille s'ouvre par le BAS, là où se trouve le pouce, et son déclencheur
// est la pastille du coin haut, atteignable au pouce droit (inversable pour les
// gauchers par le réglage de côté dominant).
//
// ÉTATS (DESIGN ECR-28)
// chargement   : squelette de 5 lignes de mouvements, solde en fenêtre
//                squelette.
// contenu      : solde voilé, mouvements avec motif en clair et delta voilé,
//                prêt dû en évidence, sections rôle, mission et enquêtes.
// vide         : aucun mouvement au-delà de la dotation.
// erreur       : journal non relu. Le solde déjà connu localement reste
//                affiché SOUS VOILE, marqué « peut-être périmé » : un solde
//                périmé signalé est plus utile qu'un écran vide en négociation.
// acces_refuse : jeton invalide, ECR-32.

import { computed } from 'vue';

import FeuilleModale from '../composants/FeuilleModale.vue';
import PanneauPriveSolde from '../composants/PanneauPriveSolde.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ fermer: [] }>();

const magasin = utiliserMagasin();

const chargement = computed(() => magasin.etat.moi === null);
const perime = computed(() => magasin.etat.liaison === 'perdue');

const resoudre = (joueurId: string): string => pseudoDe(magasin.etat, joueurId);
</script>

<template>
  <FeuilleModale
    :titre="texte('solde.titre')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <PanneauPriveSolde
      :moi="magasin.etat.moi"
      :mouvements="magasin.etat.mes_mouvements"
      :prets="magasin.etat.prets"
      :enquetes="magasin.etat.resultats_enquete"
      :pseudo-de="resoudre"
      :chargement="chargement"
      :perime="perime"
      @fermer="emettre('fermer')"
    />
  </FeuilleModale>
</template>
