<script setup lang="ts">
// ECR-01-C · Accueil — reproduit reference-prototype/c-accueil.ecran.html :
// en-tête personnalisé (avatar + salutation + réglages), citation du génie,
// cartes Créer/Rejoindre, progression du Dernier Vœu, rappel de la règle
// d'or. Extrait de vues/EcranAccueil.vue (porte de lint max-lines) : purement
// présentationnel, tout l'état vient de l'appelant.
//
// ÉCART ASSUMÉ au prototype, à signaler : le prototype met « Créer » en carte
// dorée (principale) et « Rejoindre » en carte secondaire. Le code existant
// avant cette page inversait ce choix par raisonnement Von Restorff — sur une
// table de 5 à 8, un seul crée et 4 à 7 rejoignent, l'action MAJORITAIRE
// portait l'accent. Ici, fidélité au positionnement du prototype l'emporte,
// sur demande explicite : Créer reprend l'accent visuel. Le raisonnement
// Von Restorff n'est pas réfuté, juste priorisé différemment par ce choix.
//
// « Apprendre les règles » OUVRE composants/ReglesExplicatives.vue en
// superposition, en état local à ce composant : même principe que A et B
// dans EcranAccueil.vue, un état de plus ne devient pas un 33e écran.
//
// L'indicateur de liaison du prototype (et de l'ancien ECR-01 pré-A/B/C) est
// RETIRÉ de cet en-tête : avant toute session, la liaison est structurellement
// « inactive » en permanence (aucun canal temps réel n'existe encore), donc le
// libellé n'informait de rien — juste du bruit permanent à côté du pseudo.
//
// Le bouton d'en-tête à côté du pseudo n'ouvre plus les réglages
// d'équilibrage (restent atteignables depuis ECR-02, « Régler
// l'équilibrage ») : il bascule le thème clair/sombre, sur demande explicite
// — UN bouton, UNE fonction, plutôt que deux boutons visuellement identiques
// l'un à côté de l'autre comme la première tentative.

import { computed, ref } from 'vue';

import AvatarApercu from './AvatarApercu.vue';
import BandeauAlerte from './BandeauAlerte.vue';
import BoutonAction from './BoutonAction.vue';
import CarteAction from './CarteAction.vue';
import CarteRegles from './CarteRegles.vue';
import ReglesExplicatives from './ReglesExplicatives.vue';
import SqueletteChargement from './SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import type { ChoixTheme } from '../magasin/preferences.ts';

interface Props {
  pseudo: string;
  couleurId: string;
  theme: ChoixTheme;
  serveurInjoignable: boolean;
  raisonIndisponible: string;
  chargement: boolean;
  jetonPresent: boolean;
  partiesTerminees: number;
  partiesRequises: number;
}

const props = defineProps<Props>();
const emettre = defineEmits<{
  rejoindre: [];
  creer: [];
  reprendre: [];
  relancerSonde: [];
  basculerTheme: [];
}>();

const reglesOuvertes = ref(false);
const debloque = computed(() => props.partiesTerminees >= props.partiesRequises);
</script>

<template>
  <ReglesExplicatives
    v-if="reglesOuvertes"
    @fermer="reglesOuvertes = false"
  />

  <section
    v-else
    class="menu"
  >
    <header class="menu__entete">
      <AvatarApercu
        :pseudo="props.pseudo"
        :couleur-id="props.couleurId"
        taille="mini"
      />
      <div class="menu__salutation">
        <span class="menu__bon-retour">{{ texte('ecran.accueil.bon_retour') }}</span>
        <span class="menu__pseudo">{{ props.pseudo }}</span>
      </div>
      <button
        type="button"
        class="menu__reglages"
        :aria-label="texte(props.theme === 'sombre' ? 'commun.basculer_theme_clair' : 'commun.basculer_theme_sombre')"
        @click="emettre('basculerTheme')"
      >
        <svg
          v-if="props.theme === 'sombre'"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="10"
            cy="10"
            r="4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M17 11.5A7.5 7.5 0 018.5 3a7.5 7.5 0 109.5 10.5c-.3.03-.6.05-1 .05a7.47 7.47 0 01-.5-2.05z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>

    <p class="menu__citation">
      {{ texte('ecran.accueil.citation_genie') }}
    </p>

    <BandeauAlerte
      v-if="props.serveurInjoignable"
      variante="erreur"
      cle-contenu="ecran.accueil.serveur_injoignable"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="emettre('relancerSonde')"
    />

    <CarteAction
      :libelle="texte('ecran.accueil.creer')"
      :description="texte('ecran.accueil.creer_description')"
      variante="principal"
      :desactive="props.serveurInjoignable"
      :raison="props.raisonIndisponible"
      @agir="emettre('creer')"
    />
    <CarteAction
      :libelle="texte('ecran.accueil.rejoindre')"
      :description="texte('ecran.accueil.rejoindre_description')"
      variante="secondaire"
      :desactive="props.serveurInjoignable"
      :raison="props.raisonIndisponible"
      @agir="emettre('rejoindre')"
    />

    <CarteRegles @ouvrir="reglesOuvertes = true" />

    <SqueletteChargement
      v-if="props.chargement"
      :lignes="1"
      hauteur="var(--gdv-hauteur-bouton-md)"
      :libelle="texte('commun.chargement')"
    />
    <BoutonAction
      v-else-if="props.jetonPresent"
      :libelle="texte('ecran.accueil.reprendre')"
      variante="discret"
      taille="md"
      @agir="emettre('reprendre')"
    />

    <section
      v-if="props.partiesRequises > 0"
      class="menu__dernier-voeu"
    >
      <div class="menu__dv-ligne">
        <span class="menu__dv-titre">{{ texte('ecran.accueil.dernier_voeu_titre') }}</span>
        <span class="menu__dv-compte">
          {{ texte('ecran.accueil.dernier_voeu_compte', {
            terminees: props.partiesTerminees, requises: props.partiesRequises
          }) }}
          <template v-if="debloque">· {{ texte('ecran.accueil.dernier_voeu_debloque') }}</template>
        </span>
      </div>
      <div class="menu__dv-piste">
        <div
          class="menu__dv-progres"
          :style="{
            width: `${Math.min(100, (props.partiesTerminees / props.partiesRequises) * 100)}%`
          }"
        />
      </div>
      <span class="menu__dv-aide">
        {{ texte(debloque ? 'ecran.accueil.dernier_voeu_aide_debloque' : 'ecran.accueil.dernier_voeu_aide', {
          requises: props.partiesRequises
        }) }}
      </span>
    </section>

    <p class="menu__regle-or">
      {{ texte('ecran.accueil.regle_or') }}
    </p>
  </section>
</template>

<style scoped>
.menu {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.menu__entete {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
}

.menu__salutation {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.menu__bon-retour {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.menu__pseudo {
  font-size: var(--gdv-role-titre-section);
  font-weight: var(--gdv-graisse-tres-gras);
}

.menu__reglages {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-principal);
  cursor: pointer;
}

.menu__reglages svg {
  inline-size: var(--gdv-espacement-24);
  block-size: var(--gdv-espacement-24);
}

.menu__reglages:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

/* famille.titre : rôle d'affichage, or autorisé (seuil de
   _regle_or_jamais_en_texte_courant franchi). */
.menu__citation {
  margin: 0;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-section);
  line-height: var(--gdv-interligne-titre);
}

.menu__dernier-voeu {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  padding: var(--gdv-espacement-16);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
}

.menu__dv-ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.menu__dv-titre {
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-tres-gras);
}

.menu__dv-compte {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.menu__dv-piste {
  block-size: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-bordure-champ);
  overflow: hidden;
}

.menu__dv-progres {
  block-size: 100%;
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-accent-action);
}

.menu__dv-aide {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.menu__regle-or {
  margin: var(--gdv-espacement-16) 0 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-align: center;
}
</style>
