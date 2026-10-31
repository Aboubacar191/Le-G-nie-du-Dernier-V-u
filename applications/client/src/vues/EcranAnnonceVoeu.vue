<script setup lang="ts">
// ECR-10 — Annonce du vœu. Phase VOEU, 20 s, SANS action de joueur.
//
// POINT CRITIQUE — RG-77, mesure M7-a. L'écran ne doit pas permettre de déduire
// qui porte la clause. La carte « Le pli du génie » est donc rendue
// INCONDITIONNELLEMENT, à la même place et au même instant chez tous les
// joueurs, dans un état masqué identique. Sous maintien, elle affiche soit la
// clause, soit « Aucun pli ne t'a été confié cette manche ».
//
// C'est légitime sans information supplémentaire du serveur : une clause est
// tirée à CHAQUE manche par règle (RG-18), donc l'existence d'un pli n'est pas
// une donnée à transmettre. Seul son DESTINATAIRE est secret, et c'est
// exactement ce que le masquage identique protège.
//
// Un voisin qui observe l'écran masqué n'apprend rien. Il n'y a aucun badge,
// aucun compteur, aucune variation d'apparence liée à la réception.
//
// ÉTATS (DESIGN ECR-10)
// chargement   : bulle en chargement, objectif en squelette de largeur fixe,
//                minuteur à deux tirets — jamais un zéro.
// contenu      : bandeau de phase, parole du génie au centre du cercle avec
//                l'objectif en grand, carte de pli voilée en pied.
// vide         : NON atteignable — la phase VOEU publie toujours un objectif.
// erreur       : annonce non reçue, bulle en erreur. Aucun objectif n'est
//                inventé, et le minuteur reste affiché pour que le joueur sache
//                qu'il doit se préparer.
// acces_refuse : jeton invalide, ECR-32.

import { computed } from 'vue';

import BulleGenie from '../composants/BulleGenie.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const voeu = computed(() => magasin.etat.voeu);
const etatBulle = computed(() => (voeu.value === null ? 'chargement' : 'repos'));

const clause = computed(() => magasin.etat.clause_recue?.clause ?? null);
/** Clé de rendu : tout changement de manche remasque le pli (mesure M3). */
const clePhase = computed(() => `${magasin.etat.numero_manche ?? 0}-${magasin.etat.phase ?? ''}`);
</script>

<template>
  <section class="voeu">
    <CercleDesPlaces
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="magasin.etat.moi?.joueur_id ?? ''"
      variante="lecture"
      :declarations="magasin.etat.declarations"
    >
      <template #centre>
        <BulleGenie
          variante="annonce"
          :etat="etatBulle"
          :phrase="voeu === null ? '' : texte('ecran.voeu.annonce', { objectif: voeu.objectif })"
        />
      </template>
    </CercleDesPlaces>

    <p
      v-if="voeu !== null"
      class="voeu__objectif"
    >
      <span class="voeu__etiquette">{{ texte('ecran.voeu.objectif_libelle') }}</span>
      <span class="voeu__nombre">{{ voeu.objectif }}</span>
    </p>

    <!-- Rendue SANS CONDITION : c'est la mesure M7-a. Ne jamais remplacer ce
         composant par un v-if sur `clause` — ce serait rouvrir la fuite. -->
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.voeu.pli_du_genie')"
      :cle-phase="clePhase"
    >
      <template #secret>
        <span class="voeu__pli">
          {{ clause === null ? texte('ecran.voeu.aucun_pli') : texte(`clause.${clause}`) }}
        </span>
      </template>
    </VoileSecret>
  </section>
  <!-- Aucun élément conditionné par `clause` au-delà du CONTENU de la fenêtre
       de lecture : un libellé d'aide, une pastille ou un compteur qui
       n'apparaîtrait que chez le porteur le désignerait au voisin (M7-c). -->
</template>

<style scoped>
.voeu {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.voeu__objectif {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-4);
  margin: 0;
}

.voeu__etiquette {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.voeu__nombre {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.voeu__pli {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}
</style>
