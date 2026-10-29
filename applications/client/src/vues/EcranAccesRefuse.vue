<script setup lang="ts">
// ECR-32 — Accès refusé (CA-44, RG-71). Terminal.
//
// REFUSER SANS RENSEIGNER. Un message d'erreur trop précis est lui-même une
// fuite : distinguer « jeton expiré » de « jeton inconnu » confirmerait à un
// client modifié l'existence d'une session ou d'un joueur. La formulation est
// donc UNIQUE pour tous les motifs de refus.
//
// Rien n'est affiché de la session visée : ni son existence, ni le pseudo du
// joueur légitime, ni l'état de la partie, ni quelle partie du jeton est
// invalide.
//
// Un hôte dont le jeton est invalide est traité EXACTEMENT comme un marchand.
// Aucun chemin de récupération privilégié n'existe : ce serait une surface
// d'usurpation du rôle d'hôte.
//
// Le jeton local invalide est effacé pour ne pas boucler — c'est le magasin qui
// le fait, dès que la liaison passe en « refusée ».
//
// ÉTATS (DESIGN ECR-32)
// chargement   : vérification du jeton, squelette bref puis barre indéterminée.
// contenu      : message uniforme, deux sorties.
// vide         : non atteignable.
// erreur       : serveur injoignable pendant la vérification — message DISTINCT,
//                car ce n'est PAS un refus de droit. Confondre une panne réseau
//                et un refus ferait abandonner un joueur légitime.
// acces_refuse : cet écran EST l'état d'accès refusé de toute l'application.

import { computed } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import MinuteurPhase from '../composants/MinuteurPhase.vue';
import { texte } from '../logique/contenu.ts';
import { DECOMPTE_INCONNU } from '../logique/decompte.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const verificationEnCours = computed(
  () => magasin.etat.liaison === 'connexion' || magasin.etat.liaison === 'authentification',
);

/**
 * Le seul cas où le message DIFFÈRE : la panne réseau. Elle n'est pas un refus
 * de droit, et la confondre avec un refus ferait renoncer un joueur légitime.
 */
const panneReseau = computed(() => !magasin.etat.acces_refuse);
</script>

<template>
  <main class="refus">
    <MinuteurPhase
      v-if="verificationEnCours"
      variante="barre"
      taille="md"
      indeterminee
      :decompte="DECOMPTE_INCONNU"
      :libelle="texte('connexion.chargement')"
    />

    <BandeauAlerte
      v-else-if="panneReseau"
      variante="erreur"
      cle-contenu="ecran.acces_refuse.panne_reseau"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="magasin.reprendre()"
    />

    <!-- Formulation UNIQUE, quel que soit le motif réel. -->
    <p
      v-else
      class="refus__message"
    >
      {{ texte('ecran.acces_refuse.message') }}
    </p>

    <footer class="refus__pied">
      <BoutonAction
        :libelle="texte('commun.retour_accueil')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="magasin.quitter()"
      />
      <BoutonAction
        :libelle="texte('ecran.acces_refuse.rejoindre_avec_code')"
        variante="secondaire"
        taille="md"
        @agir="magasin.naviguer('adhesion')"
      />
    </footer>
  </main>
</template>

<style scoped>
.refus {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.refus__message {
  margin: 0;
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  font-size: var(--gdv-role-titre-section);
  line-height: var(--gdv-interligne-courant);
}

.refus__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}
</style>
