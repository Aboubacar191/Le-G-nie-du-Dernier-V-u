<script setup lang="ts">
// ECR-01-B · Bienvenue — reproduit reference-prototype/
// b-bienvenue-premiere-ouverture.ecran.html : aperçu d'avatar (couleur +
// initiale, AvatarApercu.vue), pseudo, sélection de couleur
// (SelecteurCouleurJoueur.vue), CTA. Ordre identique au prototype : l'aperçu
// AVANT le champ qui l'alimente, puisqu'il réagit à la frappe.
//
// Extrait de vues/EcranAccueil.vue (porte de lint max-lines) : ce composant
// est purement présentationnel, tout l'état (pseudo, couleur, préremplissage
// dans le magasin) reste porté par l'appelant.

import AvatarApercu from './AvatarApercu.vue';
import BoutonAction from './BoutonAction.vue';
import ChampTexteCourt from './ChampTexteCourt.vue';
import SelecteurCouleurJoueur from './SelecteurCouleurJoueur.vue';
import { texte } from '../logique/contenu.ts';

interface Props {
  pseudo: string;
  couleur: string;
  erreurPseudo: string;
  longueurMaxPseudo: number;
}

const props = defineProps<Props>();
const emettre = defineEmits<{
  'update:pseudo': [valeur: string];
  'update:couleur': [valeur: string];
  entrer: [];
}>();
</script>

<template>
  <section class="bienvenue">
    <p class="bienvenue__etiquette">
      {{ texte('ecran.accueil.bienvenue_etiquette') }}
    </p>
    <h1 class="bienvenue__titre">
      {{ texte('ecran.accueil.bienvenue_titre') }}
    </h1>
    <p class="bienvenue__accroche">
      {{ texte('ecran.accueil.bienvenue_accroche') }}
    </p>

    <AvatarApercu
      :pseudo="props.pseudo"
      :couleur-id="props.couleur"
    />

    <div class="bienvenue__champ-pseudo">
      <ChampTexteCourt
        :valeur="props.pseudo"
        variante="pseudo"
        :libelle="texte('ecran.creation.libelle_pseudo')"
        :aide="texte('ecran.creation.aide_pseudo')"
        :erreur="props.erreurPseudo"
        :longueur-max="props.longueurMaxPseudo"
        @update:valeur="emettre('update:pseudo', $event)"
      />
    </div>

    <SelecteurCouleurJoueur
      :model-value="props.couleur"
      @update:model-value="emettre('update:couleur', $event)"
    />

    <BoutonAction
      class="bienvenue__entrer"
      :libelle="texte('ecran.accueil.bienvenue_entrer')"
      variante="principal"
      taille="lg"
      pleine-largeur
      @agir="emettre('entrer')"
    />
  </section>
</template>

<style scoped>
/* Mêmes jetons que vues/EcranAccueil.vue : aucun jeton créé pour cet état. */
.bienvenue {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.bienvenue__etiquette {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-transform: uppercase;
  letter-spacing: var(--gdv-suivi-titre);
}

/* Taille empruntée à titre-ecran : aucun rôle neutre plus grand n'existe
   (même contrainte que AvatarApercu.vue). */
.bienvenue__titre {
  margin: 0;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-ecran);
  font-weight: var(--gdv-graisse-tres-gras);
  line-height: var(--gdv-interligne-titre);
}

.bienvenue__accroche {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

/* Champ pseudo réduit de 10 % par rapport à la pleine largeur (5 % + 5 % de
   plus, demandés en deux temps) : seule exception dimensionnelle de cet
   écran. Réduit depuis la DROITE seulement (aucun align-self), pour garder
   le bord gauche aligné avec l'étiquette et le titre au-dessus — un centrage
   décalait visiblement le champ vers la droite par rapport à eux. */
.bienvenue__champ-pseudo {
  inline-size: 90%;
}

.bienvenue__entrer {
  margin-block-start: auto;
}
</style>
