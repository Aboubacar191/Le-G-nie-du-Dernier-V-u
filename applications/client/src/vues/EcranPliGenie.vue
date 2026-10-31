<script setup lang="ts">
// ECR-11 — Le pli du génie, surface SUPERPOSÉE de la phase VOEU (US-07, RG-18).
//
// Remettre la clause en privé au porteur et à tout FAISEUR_CONTRATS, pour qu'il
// la dise, la vende, la taise ou mente.
//
// L'écran ne NOMME JAMAIS la raison de la réception. Dire « tu reçois ce pli
// parce que tu es Faiseur de contrats » trahirait le rôle d'un joueur qui
// montrerait son écran, et distinguerait le porteur du faiseur — distinction
// que la matrice_visibilite protège.
//
// Un joueur NON destinataire qui atteindrait cette surface obtient « Aucun pli
// ne t'a été confié cette manche », et jamais un message de refus : un refus
// confirmerait par élimination qu'un pli existe ailleurs.
//
// ÉTATS (DESIGN ECR-11)
// chargement   : voile en chargement, « Le génie prépare ton pli ».
// contenu      : sous maintien, libellé de la clause et son effet en une
//                phrase ; au relâchement, remasquage immédiat.
// vide         : joueur non destinataire — « Aucun pli ne t'a été confié ».
//                C'est un CONTENU, et c'est ce qui rend l'état masqué
//                indiscernable (M7-a).
// erreur       : pli illisible, reprise. Jamais de clause inventée ni partielle.
// acces_refuse : traité comme l'état vide, délibérément.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import FeuilleModale from '../composants/FeuilleModale.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ fermer: [] }>();

const magasin = utiliserMagasin();

const clause = computed(() => magasin.etat.clause_recue?.clause ?? null);
const clePhase = computed(() => `${magasin.etat.numero_manche ?? 0}-pli`);
</script>

<template>
  <FeuilleModale
    :titre="texte('ecran.voeu.pli_du_genie')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.voeu.pli_du_genie')"
      :cle-phase="clePhase"
    >
      <!-- Le libellé de la clause ET son effet sont dans la MÊME fenêtre de
           lecture. Un second voile conditionné par la réception donnerait une
           carte de plus au porteur : le voisin compterait les cartes et saurait
           (M7-c). Ici, masqué, l'écran est identique pour tout le monde. -->
      <template #secret>
        <span class="pli__contenu">
          <template v-if="clause === null">
            {{ texte('ecran.voeu.aucun_pli') }}
          </template>
          <template v-else>
            {{ texte(`clause.${clause}`) }} — {{ texte(`clause_description.${clause}`) }}
          </template>
        </span>
      </template>
    </VoileSecret>

    <BoutonAction
      :libelle="texte('ecran.voeu.fermer_pli')"
      variante="secondaire"
      taille="md"
      pleine-largeur
      @agir="emettre('fermer')"
    />
  </FeuilleModale>
</template>

<style scoped>
/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.pli__contenu {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}
</style>
