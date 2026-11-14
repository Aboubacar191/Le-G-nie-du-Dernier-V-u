<script setup lang="ts">
// ECR-04 — Invitation : code et QR. Faire entrer la table en quelques
// secondes, sans compte ni saisie d'URL.
//
// Le code est affiché en très grand ET relisible à voix haute : son jeu de
// caractères est sans ambiguïté visuelle (ni O ni 0, ni I ni l ni 1), ce qui
// est le premier facteur de réussite d'une adhésion dans une pièce bruyante.
//
// jeton_hote n'est JAMAIS affiché. L'URL encodée dans le QR ne contient aucun
// jeton : seulement le code d'adhésion.
//
// ÉTATS (DESIGN ECR-04)
// chargement   : code non encore émis, squelette aux dimensions exactes du code
//                et du QR. Jamais de code provisoire : l'hôte le lirait à voix
//                haute avant qu'il ne devienne invalide.
// contenu      : code en grand, QR dessous, compteur de connectés, bouton
//                d'agrandissement.
// vide         : nominal avant la première adhésion — personne n'a rejoint.
// erreur       : collision de code, le serveur en émet un autre et le bandeau
//                prévient, parce que l'hôte vient peut-être de le dire.
// acces_refuse : non-hôte — seul l'hôte diffuse l'invitation.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import IndicateurConnexion from '../composants/IndicateurConnexion.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { tracerQr, urlAdhesion } from '../logique/code-qr.ts';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const agrandi = ref(false);
const copie = ref(false);

const code = computed(
  () => magasin.etat.session?.code_adhesion ?? magasin.codeAdhesionPrerempli(),
);
const nbConnectes = computed(() => magasin.etat.joueurs.filter((j) => j.connecte).length);
// Avant la première projection, `moi` est nul : l'écran vient d'être atteint
// par la création, donc son auteur est l'hôte. Après, c'est le serveur qui dit.
const hote = computed(() => magasin.etat.moi === null || magasin.etat.moi.est_hote);

const lien = computed(() =>
  urlAdhesion(globalThis.location?.origin ?? '', `/adhesion/${code.value}`),
);
const trace = computed(() => (code.value === '' ? null : tracerQr(lien.value)));

async function copierCode(): Promise<void> {
  await globalThis.navigator?.clipboard?.writeText(code.value);
  copie.value = true;
}
</script>

<template>
  <main
    class="invitation"
    :class="{ 'invitation--agrandi': agrandi }"
  >
    <EtatVide
      v-if="!hote"
      :titre="texte('ecran.invitation.acces_refuse')"
      :action-libelle="texte('ecran.invitation.voir_salle_attente')"
      @agir="magasin.naviguer('accueil')"
    />

    <template v-else>
      <header class="invitation__entete">
        <h1 class="invitation__titre">
          {{ texte('ecran.invitation.titre') }}
        </h1>
        <IndicateurConnexion :liaison="magasin.etat.liaison" />
      </header>

      <BandeauAlerte
        v-if="copie"
        variante="succes"
        cle-contenu="ecran.invitation.code_copie"
        @expirer="copie = false"
      />

      <SqueletteChargement
        v-if="code === ''"
        :lignes="2"
        hauteur="var(--gdv-cible-geante)"
        :libelle="texte('commun.chargement')"
      />

      <template v-else>
        <p class="invitation__etiquette">
          {{ texte('ecran.invitation.libelle_code') }}
        </p>
        <p class="invitation__code">
          {{ code }}
        </p>

        <svg
          v-if="trace !== null"
          class="invitation__qr"
          :viewBox="`0 0 ${trace.taille} ${trace.taille}`"
          role="img"
          :aria-label="texte('ecran.invitation.alt_qr', { code })"
          shape-rendering="crispEdges"
        >
          <rect
            class="invitation__qr-fond"
            x="0"
            y="0"
            :width="trace.taille"
            :height="trace.taille"
          />
          <path
            class="invitation__qr-modules"
            :d="trace.chemin"
          />
        </svg>

        <p class="invitation__compteur">
          {{ texte('ecran.invitation.connectes', { n: nbConnectes }) }}
        </p>

        <EtatVide
          v-if="nbConnectes <= 1"
          :titre="texte('ecran.invitation.personne')"
          :action-libelle="texte('ecran.invitation.agrandir_qr')"
          @agir="agrandi = true"
        />

        <div class="invitation__actions">
          <BoutonAction
            :libelle="texte('ecran.invitation.agrandir_qr')"
            variante="principal"
            taille="lg"
            pleine-largeur
            @agir="agrandi = !agrandi"
          />
          <BoutonAction
            :libelle="texte('ecran.invitation.copier_code')"
            variante="secondaire"
            taille="md"
            @agir="copierCode"
          />
          <BoutonAction
            :libelle="texte('ecran.invitation.aller_salle_attente')"
            variante="discret"
            taille="md"
            @agir="magasin.naviguer('accueil')"
          />
        </div>
      </template>
    </template>
  </main>
</template>

<style scoped>
.invitation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-12);
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.invitation__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
  inline-size: 100%;
}

.invitation__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.invitation__etiquette {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

/* Le code est relu à voix haute : chiffres tabulaires, lettres espacées. */
.invitation__code {
  margin: 0;
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
  letter-spacing: var(--gdv-espacement-8);
}

.invitation__qr {
  inline-size: 100%;
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  aspect-ratio: 1;
}

/* Les deux seules couleurs admises pour un QR sont le contraste maximal de la
   surface : un QR teinté perd en fiabilité de lecture. */
.invitation__qr-fond {
  fill: var(--gdv-surface-primaire);
}

.invitation__qr-modules {
  fill: var(--gdv-texte-principal);
}

/* Agrandissement : le QR occupe tout, la luminosité est poussée par la surface
   la plus claire du thème. */
.invitation--agrandi .invitation__qr {
  max-inline-size: none;
}

.invitation--agrandi {
  background: var(--gdv-surface-primaire);
}

.invitation__compteur {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
}

.invitation__actions {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  inline-size: 100%;
  margin-block-start: auto;
}
</style>
