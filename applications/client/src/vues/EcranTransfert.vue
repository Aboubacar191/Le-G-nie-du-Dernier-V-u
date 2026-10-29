<script setup lang="ts">
// ECR-13 — Transfert de pièces. Honorer à l'écran un accord conclu à voix haute
// (US-12).
//
// Le montant disponible ET le montant saisi sont SOUS VOILE : un voisin qui
// lirait le solde par-dessus l'épaule en déduirait le paiement de la manche
// précédente par différence (ADR-CP-05).
//
// Le bouton de prêt vit ICI, en seconde option, et non sur l'écran de fond :
// c'est ce qui garde l'écran au repos identique chez tous les joueurs, alors
// que seul le PRETEUR peut prêter (RG-29).
//
// ÉTATS (DESIGN ECR-13)
// chargement   : cibles en squelette ; à la soumission, bouton en chargement et
//                cibles désactivées pour éviter la double soumission (RG-70).
// contenu      : cibles en haut, incrémenteur voilé en bas (zone du pouce),
//                bouton en pied.
// vide         : aucune cible joignable — « Aucun marchand n'est joignable ».
// erreur       : solde insuffisant, le pas « plus » passe en borne_atteinte ;
//                refus serveur, la feuille RESTE OUVERTE et la saisie est
//                conservée.
// acces_refuse : hors phase NEGOCIATION — les transferts ne se font que
//                pendant la négociation.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import CarteJoueurCercle from '../composants/CarteJoueurCercle.vue';
import EtatVide from '../composants/EtatVide.vue';
import FeuilleModale from '../composants/FeuilleModale.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { bornes, raccourcisTransfert } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

interface Props {
  preteur: boolean;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ fermer: []; proposerPret: [] }>();

const magasin = utiliserMagasin();

const cible = ref<string | null>(null);
const montant = ref(0);
const envoi = ref(false);

const horsPhase = computed(() => magasin.etat.phase !== 'NEGOCIATION');
const solde = computed(() => magasin.etat.moi?.solde_pieces ?? 0);
const limites = computed(() => bornes(0, solde.value));
const raccourcis = computed(() => raccourcisTransfert(limites.value, solde.value));

const cibles = computed(() =>
  magasin.etat.joueurs.filter((joueur) => joueur.joueur_id !== magasin.etat.moi?.joueur_id),
);
const joignables = computed(() => cibles.value.filter((joueur) => joueur.connecte));

function transferer(): void {
  if (cible.value === null) return;
  envoi.value = true;
  magasin.envoyer('transferer_pieces', {
    cible_joueur_id: cible.value,
    montant: montant.value,
  });
  envoi.value = false;
}
</script>

<template>
  <FeuilleModale
    :titre="texte('ecran.transfert.titre')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <EtatVide
      v-if="horsPhase"
      :titre="texte('ecran.transfert.hors_phase')"
      :action-libelle="texte('commun.fermer')"
      @agir="emettre('fermer')"
    />

    <template v-else>
      <!-- Une erreur garde la feuille ouverte et la saisie intacte : fermer sur
           erreur perdrait le travail du joueur dans une fenêtre minutée. -->
      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <EtatVide
        v-if="joignables.length === 0"
        :titre="texte('ecran.transfert.aucune_cible')"
        :action-libelle="texte('commun.fermer')"
        @agir="emettre('fermer')"
      />

      <template v-else>
        <p class="transfert__etiquette">
          {{ texte('ecran.transfert.libelle_cible') }}
        </p>
        <ul class="transfert__cibles">
          <li
            v-for="joueur in cibles"
            :key="joueur.joueur_id"
          >
            <CarteJoueurCercle
              :pseudo="joueur.pseudo"
              :position-cercle="joueur.position_cercle"
              :connecte="joueur.connecte"
              variante="selectionnable"
              :selectionnee="cible === joueur.joueur_id"
              :raison-indisponible="envoi ? texte('commun.chargement') : ''"
              @choisir="cible = joueur.joueur_id"
            />
          </li>
        </ul>

        <!-- Le montant ET la borne (le solde) sont dans le voile. -->
        <VoileSecret
          variante="saisie"
          :intitule="texte('ecran.transfert.titre')"
        >
          <template #saisie>
            <IncrementeurMontant
              v-model:valeur="montant"
              :bornes="limites"
              variante="secret"
              :raccourcis="raccourcis"
              :desactive="envoi"
              :intitule="texte('incrementeur.libelle_groupe')"
            />
          </template>
        </VoileSecret>

        <BoutonAction
          :libelle="texte('ecran.transfert.transferer')"
          variante="principal"
          taille="lg"
          pleine-largeur
          :desactive="cible === null || envoi"
          :raison="texte('ecran.transfert.choisis_cible')"
          :chargement="envoi"
          @agir="transferer"
        />

        <!-- Monopole du PRETEUR, en SECONDE option, à l'intérieur de la feuille. -->
        <BoutonAction
          v-if="props.preteur"
          :libelle="texte('ecran.negociation.proposer_pret')"
          variante="secondaire"
          taille="md"
          pleine-largeur
          @agir="emettre('proposerPret')"
        />

        <BoutonAction
          :libelle="texte('commun.annuler')"
          variante="discret"
          taille="md"
          @agir="emettre('fermer')"
        />
      </template>
    </template>
  </FeuilleModale>
</template>

<style scoped>
.transfert__etiquette {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.transfert__cibles {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
