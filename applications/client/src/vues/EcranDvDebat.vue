<script setup lang="ts">
// ECR-24 — Dernier Vœu, débat. Phase DV_DEBAT, 60 s, aucun calcul serveur.
//
// L'application SE RETIRE volontairement. Elle n'offre aucun moyen de
// s'engager avant la phase de signature : un pré-engagement enregistré serait
// une information exploitable, et il n'existe aucune commande pour le porter.
//
// Aucune commande d'avance de phase n'est autorisée ici : seule la NEGOCIATION
// l'admet.
//
// ÉTATS (DESIGN ECR-24)
// chargement   : bandeau de phase actif, cercle en squelette.
// contenu      : minuteur large, table de résolution, cercle des places.
// vide         : c'est l'état NOMINAL de cet écran — il n'a pas de contenu
//                dynamique. L'état vide EST le contenu, et sa sortie est la
//                conversation.
// erreur       : perte de liaison. Le message annonce la CONSÉQUENCE : si tu ne
//                reviens pas avant la signature, le génie comptera un refus.
// acces_refuse : mode avancé inactif — non atteignable.

import { computed } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import MinuteurPhase from '../composants/MinuteurPhase.vue';
import { utiliserHorlogeAffichage } from '../composables/horloge-affichage.ts';
import { texte } from '../logique/contenu.ts';
import { calculerDecompte } from '../logique/decompte.ts';
import { dureePhaseS } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const maintenant = utiliserHorlogeAffichage();

const recompense = computed((): number => {
  const config = magasin.etat.session?.config as {
    recompense_signature_dernier_voeu?: number;
  };
  return config?.recompense_signature_dernier_voeu ?? 0;
});

const decompte = computed(() =>
  calculerDecompte(
    magasin.etat.decalage,
    magasin.etat.phase_fin_at,
    maintenant.value,
    dureePhaseS(magasin.etat),
  ),
);

const liaisonPerdue = computed(() => magasin.etat.liaison === 'perdue');
</script>

<template>
  <section class="dv-debat">
    <!-- Annoncer la conséquence du défaut est indispensable : sans cela, le
         silence devient un piège. -->
    <BandeauAlerte
      v-if="liaisonPerdue"
      variante="avertissement"
      cle-contenu="connexion.consequence_signature"
    />

    <MinuteurPhase
      class="dv-debat__minuteur"
      variante="anneau"
      taille="lg"
      :decompte="decompte"
      :duree-phase-s="dureePhaseS(magasin.etat)"
      :libelle="texte('bandeau_phase.secondes_restantes', { secondes: decompte.secondes ?? 0 })"
    />

    <section class="dv-debat__regle">
      <h3 class="dv-debat__titre">
        {{ texte('ecran.dernier_voeu.table_resolution') }}
      </h3>
      <ul class="dv-debat__liste">
        <li>{{ texte('ecran.dernier_voeu.regle_1', { recompense }) }}</li>
        <li>{{ texte('ecran.dernier_voeu.regle_2') }}</li>
        <li>{{ texte('ecran.dernier_voeu.regle_3') }}</li>
      </ul>
    </section>

    <CercleDesPlaces
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="magasin.etat.moi?.joueur_id ?? ''"
      variante="lecture"
    >
      <template #centre>
        <BulleGenie
          variante="annonce"
          etat="vide"
          cle-vide="genie.se_tait_il_ecoute"
        />
      </template>
    </CercleDesPlaces>

    <p class="dv-debat__consigne">
      {{ texte('ecran.dernier_voeu.debat') }}
    </p>
  </section>
</template>

<style scoped>
.dv-debat {
  display: flex;
  flex-direction: column;
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  align-items: center;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.dv-debat__minuteur {
  align-self: center;
}

.dv-debat__regle {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  inline-size: 100%;
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
}

.dv-debat__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.dv-debat__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding-inline-start: var(--gdv-espacement-16);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

.dv-debat__consigne {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
}
</style>
