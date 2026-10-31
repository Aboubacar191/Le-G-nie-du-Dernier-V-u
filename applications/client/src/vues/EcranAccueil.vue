<script setup lang="ts">
// ECR-01 — Accueil. Orienter en un coup d'œil : créer une partie ou en
// rejoindre une. Rien d'autre.
//
// « Rejoindre » est en variante PRINCIPALE et « Créer » en secondaire : sur une
// table de 5 à 8 joueurs, un seul crée et 4 à 7 rejoignent. L'action
// majoritaire porte l'accent (Von Restorff).
//
// ÉTATS (DESIGN ECR-01)
// chargement   : vérification d'un éventuel jeton stocké. Les deux boutons sont
//                affichés dès le premier rendu ; seule l'entrée « Reprendre ma
//                partie » arrive en squelette. L'écran n'est jamais vide.
// contenu      : titre, Rejoindre, Créer, réglages en pied.
// vide         : état NOMINAL — aucune partie en cours, les deux actions sont
//                la sortie. Un EtatVide explicite le dit sans dramatiser.
// erreur       : serveur injoignable. Les deux actions restent AFFICHÉES mais
//                désactivées, avec la raison : les masquer ferait chercher.
// acces_refuse : non atteignable — l'accueil n'exige aucun droit.

import { onMounted, ref } from 'vue';

import BadgeLampe from '../composants/BadgeLampe.vue';
import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import IndicateurConnexion from '../composants/IndicateurConnexion.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import { sonderSante } from '../transport/rest.ts';

const magasin = utiliserMagasin();

const chargement = ref(true);
const serveurInjoignable = ref(false);
const jetonPresent = ref(false);

onMounted(async () => {
  const sante = await sonderSante();
  serveurInjoignable.value = !sante.ok;
  // L'entrée « Reprendre ma partie » n'apparaît que si un jeton est mémorisé :
  // proposer de reprendre une partie qui n'existe pas mène à l'écran de refus.
  jetonPresent.value = magasin.jetonMemorise();
  chargement.value = false;
});

function reprendre(): void {
  if (!magasin.reprendre()) jetonPresent.value = false;
}
</script>

<template>
  <main class="accueil">
    <header class="accueil__entete">
      <!-- La marque, et le seul élément décoratif du contrat. Elle n'est admise
           QUE sur cet écran et sur l'état de chargement de premier démarrage ;
           le h1 ci-dessous répète le nom du jeu en texte réel, donc le badge est
           déclaré aria-hidden pour ne pas l'annoncer deux fois. -->
      <BadgeLampe :titre-adjacent="true" />
      <div class="accueil__ligne-titre">
        <h1 class="accueil__titre">
          {{ texte('commun.titre_application') }}
        </h1>
        <IndicateurConnexion :liaison="magasin.etat.liaison" />
      </div>
    </header>

    <BandeauAlerte
      v-if="serveurInjoignable"
      variante="erreur"
      cle-contenu="ecran.accueil.serveur_injoignable"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="serveurInjoignable = false"
    />

    <EtatVide
      v-else
      :titre="texte('ecran.accueil.nominal')"
    />

    <div class="accueil__actions">
      <BoutonAction
        :libelle="texte('ecran.accueil.rejoindre')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="serveurInjoignable"
        :raison="serveurInjoignable ? texte('ecran.accueil.serveur_injoignable') : ''"
        @agir="magasin.naviguer('adhesion')"
      />
      <BoutonAction
        :libelle="texte('ecran.accueil.creer')"
        variante="secondaire"
        taille="lg"
        pleine-largeur
        :desactive="serveurInjoignable"
        :raison="serveurInjoignable ? texte('ecran.accueil.serveur_injoignable') : ''"
        @agir="magasin.naviguer('creation')"
      />

      <SqueletteChargement
        v-if="chargement"
        :lignes="1"
        hauteur="var(--gdv-hauteur-bouton-md)"
        :libelle="texte('commun.chargement')"
      />
      <BoutonAction
        v-else-if="jetonPresent"
        :libelle="texte('ecran.accueil.reprendre')"
        variante="discret"
        taille="md"
        @agir="reprendre"
      />
    </div>

    <footer class="accueil__pied">
      <BoutonAction
        :libelle="texte('commun.reglages')"
        variante="discret"
        taille="md"
        @agir="magasin.naviguer('reglages')"
      />
    </footer>
  </main>
</template>

<style scoped>
.accueil {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.accueil__entete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-16);
}

.accueil__ligne-titre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
  inline-size: 100%;
}

/* famille.titre n'est admise que sur titre-ecran, titre-section et voix-genie.
   L'or y est autorisé : le rôle est à 24 px, bien au-delà des 20 px du seuil
   de couleur._regle_or_jamais_en_texte_courant. */
.accueil__titre {
  margin: 0;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-ecran);
  font-weight: var(--gdv-graisse-tres-gras);
  line-height: var(--gdv-interligne-titre);
  letter-spacing: var(--gdv-suivi-titre);
}

/* Un seul bouton de variante principale, isolé par espacement.24 de tout autre
   élément actionnable (Von Restorff). */
.accueil__actions {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}

.accueil__pied {
  display: flex;
  justify-content: center;
}
</style>
