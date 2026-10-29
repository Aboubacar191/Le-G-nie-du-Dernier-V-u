<script setup lang="ts">
// ECR-06 — Salle d'attente (RG-02, CA-02). Montrer qui est entré, et rendre la
// condition de démarrage LISIBLE sans la deviner.
//
// Le bouton de démarrage reste VISIBLE et désactivé pour l'hôte, avec sa raison
// chiffrée : le masquer laisserait l'hôte chercher ce qui manque.
//
// Rien n'est encore distribué : aucun rôle, aucune mission, aucun solde. Cet
// écran n'a donc aucun secret à protéger, et c'est pour cela qu'il n'a aucun
// voile — le contraste avec les écrans suivants est pédagogique.
//
// ÉTATS (DESIGN ECR-06)
// chargement   : squelette de 5 lignes de joueurs, aux dimensions des cartes.
// contenu      : liste des connectés, compteur « n marchands sur 5 minimum »,
//                et pour l'hôte le bouton de démarrage.
// vide         : l'hôte seul — « Tu es seul dans le cercle », sortie vers le QR.
// erreur       : un joueur perdu passe en carte déconnectée et le bandeau dit
//                l'effectif restant ; échec de démarrage hors de [min, max].
// acces_refuse : jeton invalide, redirection vers ECR-32 par le magasin.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import CarteJoueurCercle from '../composants/CarteJoueurCercle.vue';
import DialogueConfirmationIrreversible from '../composants/DialogueConfirmationIrreversible.vue';
import EtatVide from '../composants/EtatVide.vue';
import IndicateurConnexion from '../composants/IndicateurConnexion.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const confirmerAbandon = ref(false);

interface Bornes {
  readonly min: number;
  readonly max: number;
}

const bornesEffectif = computed((): Bornes => {
  const config = magasin.etat.session?.config as
    | { joueurs_min?: number; joueurs_max?: number }
    | undefined;
  return { min: config?.joueurs_min ?? 0, max: config?.joueurs_max ?? 0 };
});

const connectes = computed(() => magasin.etat.joueurs.filter((joueur) => joueur.connecte));
const nbConnectes = computed(() => connectes.value.length);
const hote = computed(() => magasin.etat.moi?.est_hote === true);
const chargement = computed(() => magasin.etat.joueurs.length === 0);

const effectifSuffisant = computed(
  () =>
    nbConnectes.value >= bornesEffectif.value.min &&
    nbConnectes.value <= bornesEffectif.value.max,
);

const raisonDemarrage = computed(() =>
  texte('ecran.salle_attente.demarrer_desactive', {
    min: bornesEffectif.value.min,
    max: bornesEffectif.value.max,
  }),
);

const manquants = computed(() => Math.max(0, bornesEffectif.value.min - nbConnectes.value));

function abandonner(): void {
  magasin.envoyer('abandonner_partie', { confirmation: true });
  confirmerAbandon.value = false;
}
</script>

<template>
  <main class="attente">
    <header class="attente__entete">
      <h1 class="attente__titre">
        {{ texte('ecran.salle_attente.titre') }}
      </h1>
      <IndicateurConnexion :liaison="magasin.etat.liaison" />
    </header>

    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <p class="attente__compteur">
      {{ texte('ecran.salle_attente.compteur', { n: nbConnectes, min: bornesEffectif.min }) }}
    </p>
    <p class="attente__bornes">
      {{ texte('ecran.salle_attente.bornes', { min: bornesEffectif.min, max: bornesEffectif.max }) }}
      ·
      {{ magasin.etat.session?.mode_avance_actif
        ? texte('ecran.salle_attente.mode_avance_actif')
        : texte('ecran.salle_attente.mode_avance_inactif') }}
    </p>

    <SqueletteChargement
      v-if="chargement"
      :lignes="5"
      hauteur="var(--gdv-hauteur-carte-joueur)"
      :libelle="texte('commun.chargement')"
    />

    <EtatVide
      v-else-if="nbConnectes <= 1"
      :titre="texte('ecran.salle_attente.seul')"
      :corps="texte('ecran.salle_attente.manque', { n: manquants })"
      :progression="texte('ecran.salle_attente.bornes', { min: bornesEffectif.min, max: bornesEffectif.max })"
      :action-libelle="hote ? texte('ecran.salle_attente.montrer_qr') : ''"
      @agir="magasin.naviguer('invitation')"
    />

    <!-- Chaque arrivée s'insère SANS déplacer les lignes existantes : la liste
         suit l'ordre d'arrivée projeté par le serveur. -->
    <ul
      v-else
      class="attente__liste"
    >
      <li
        v-for="joueur in magasin.etat.joueurs"
        :key="joueur.joueur_id"
      >
        <CarteJoueurCercle
          :pseudo="joueur.pseudo"
          :position-cercle="joueur.position_cercle"
          :connecte="joueur.connecte"
          :relation="joueur.joueur_id === magasin.etat.moi?.joueur_id ? 'moi' : 'en_face'"
          variante="etendue"
        />
      </li>
    </ul>

    <footer class="attente__pied">
      <BoutonAction
        v-if="hote"
        :libelle="texte('cercle.fixer_places')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="!effectifSuffisant"
        :raison="raisonDemarrage"
        @agir="magasin.envoyer('demarrer_partie')"
      />
      <BoutonAction
        v-else
        :libelle="texte('ecran.salle_attente.quitter')"
        variante="discret"
        taille="md"
        @agir="magasin.quitter()"
      />

      <!-- Action destructrice volontairement ÉLOIGNÉE des actions courantes. -->
      <BoutonAction
        v-if="hote"
        class="attente__abandon"
        :libelle="texte('action.abandonner_partie')"
        variante="destructeur"
        taille="md"
        @agir="confirmerAbandon = true"
      />
    </footer>

    <DialogueConfirmationIrreversible
      v-if="confirmerAbandon"
      :titre="texte('ecran.abandon.confirmer_titre')"
      :corps="texte('ecran.abandon.confirmer_corps')"
      :libelle-confirmer="texte('action.abandonner_partie')"
      :libelle-renoncer="texte('commun.renoncer')"
      @confirmer="abandonner"
      @renoncer="confirmerAbandon = false"
    />
  </main>
</template>

<style scoped>
.attente {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.attente__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.attente__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.attente__compteur {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.attente__bornes {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.attente__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.attente__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}

.attente__abandon {
  align-self: center;
}
</style>
