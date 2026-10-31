<script setup lang="ts">
// ECR-22 — Exécution de la manche (US-11, CA-26 à CA-32). 30 s, lecture seule.
//
// C'est l'écran qui doit faire CONSTATER que le génie ne pouvait pas tricher.
//
// POINT DE VIGILANCE MAJEUR : l'écran révèle la clause mais ne doit pas
// permettre de déduire son PORTEUR. Aucune carte n'est marquée, aucun ordre
// d'affichage ne dépend du porteur, aucun libellé du type « confiée à ». Le
// porteur ne devient public JAMAIS en v1.
//
// Les parts sont au prorata des montants DÉCLARÉS (RG-14), qui sont publics :
// les publier ne divulgue donc aucun paiement. En revanche publier la
// récompense ET les paiements individuels permettrait la déduction — les
// paiements individuels restent donc secrets jusqu'aux scores.
//
// Le bilan personnel est SOUS VOILE, dans le panneau privé, jamais en clair sur
// l'écran public.
//
// ÉTATS (DESIGN ECR-22)
// chargement   : squelette aux dimensions finales, aucun saut de mise en page.
// contenu      : verdict, clause, parts, verdicts d'accusation, bilan voilé.
// vide         : vœu échoué sans consolation ni accusation — « Le génie n'a
//                rien redistribué cette manche », avec le détail du calcul en
//                sortie. L'état vide EXPLIQUE au lieu de laisser un blanc.
// erreur       : résultat non reçu. AUCUN résultat partiel n'est affiché : un
//                total faux détruirait la confiance dans l'arbitre.
// acces_refuse : jeton invalide, ECR-32.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import EtatVide from '../composants/EtatVide.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const detailDeplie = ref(false);

const resultat = computed(() => magasin.etat.execution);
const amendes = computed(() => resultat.value?.amendes_liquidees ?? []);
</script>

<template>
  <section class="execution">
    <SqueletteChargement
      v-if="resultat === null"
      :lignes="5"
      hauteur="var(--gdv-hauteur-ligne-tableau)"
      :libelle="texte('commun.chargement')"
    />

    <template v-else>
      <!-- Temps 1 : verdict, doublé du MOT et d'une forme de pastille
           distincte, jamais de la seule couleur. -->
      <h2
        class="execution__verdict"
        :class="resultat.reussi ? 'execution__verdict--reussi' : 'execution__verdict--echoue'"
      >
        <span
          class="execution__pastille"
          aria-hidden="true"
        />
        {{ resultat.reussi ? texte('ecran.execution.reussi') : texte('ecran.execution.echoue') }}
      </h2>

      <p class="execution__bilan">
        {{ texte('ecran.execution.bilan', {
          total_paye: resultat.total_paye,
          objectif: resultat.objectif,
        }) }}
      </p>

      <!-- Temps 2 : clause révélée, SANS son porteur. -->
      <BulleGenie
        variante="annonce"
        :phrase="`${texte('ecran.execution.clause_revelee')} — ${texte(`clause.${resultat.clause_revelee}`)} : ${texte(`clause_description.${resultat.clause_revelee}`)}`"
      />

      <!-- Temps 3 : seules les informations autorisées par le protocole sont publiques. -->
      <section class="execution__section">
        <EtatVide
          v-if="!resultat.reussi && amendes.length === 0"
          :titre="texte('ecran.execution.rien_redistribue')"
          :action-libelle="texte('ecran.execution.detail_calcul')"
          @agir="detailDeplie = true"
        />
      </section>

      <!-- Temps 4 : verdicts et amendes liquidées, publics dès l'EXECUTION. -->
      <section
        v-if="amendes.length > 0"
        class="execution__section"
      >
        <h3 class="execution__titre">
          {{ texte('ecran.execution.verdicts') }}
        </h3>
        <ul class="execution__parts">
          <li
            v-for="amende in amendes"
            :key="amende.accusation_id"
            class="execution__part"
          >
            {{ texte('ecran.execution.amende', {
              debiteur: pseudoDe(magasin.etat, amende.debiteur_joueur_id),
              crediteur: pseudoDe(magasin.etat, amende.crediteur_joueur_id),
              montant: amende.montant_liquide,
            }) }}
          </li>
        </ul>
      </section>

      <BandeauAlerte
        v-if="resultat.consolation_appliquee"
        variante="information"
        cle-contenu="ecran.execution.consolation_appliquee"
      />

      <!-- Preuve d'honnêteté du génie : l'enchaînement du calcul, consultable. -->
      <BoutonAction
        :libelle="texte('ecran.execution.detail_calcul')"
        variante="secondaire"
        taille="md"
        @agir="detailDeplie = !detailDeplie"
      />

      <dl
        v-if="detailDeplie"
        class="execution__detail"
      >
        <dt>{{ texte('commun.promis') }}</dt>
        <dd>{{ resultat.total_declare }}</dd>
        <dt>{{ texte('commun.recu') }}</dt>
        <dd>{{ resultat.total_paye }}</dd>
        <dt>{{ texte('ecran.execution.recompense') }}</dt>
        <dd>{{ resultat.recompense }}</dd>
        <dt>{{ texte('ecran.execution.clause_revelee') }}</dt>
        <dd>{{ texte(`clause.${resultat.clause_revelee}`) }}</dd>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.execution {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.execution__verdict {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-8);
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.execution__pastille {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
  border: var(--gdv-trait-epais) solid currentcolor;
}

/* Forme distincte EN PLUS de la couleur : pastille ronde pleine pour la
   réussite, carrée évidée pour l'échec. */
.execution__verdict--reussi {
  color: var(--gdv-statut-succes);
}

.execution__verdict--reussi .execution__pastille {
  border-radius: var(--gdv-rayon-pilule);
  background: currentcolor;
}

.execution__verdict--echoue {
  color: var(--gdv-statut-echec);
}

.execution__verdict--echoue .execution__pastille {
  border-radius: var(--gdv-rayon-aucun);
}

.execution__bilan {
  margin: 0;
  font-size: var(--gdv-role-corps);
}

.execution__section {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.execution__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.execution__parts {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.execution__part {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-8);
  min-block-size: var(--gdv-hauteur-ligne-tableau);
  padding-inline: var(--gdv-espacement-8);
  background: var(--gdv-surface-primaire);
  font-size: var(--gdv-role-corps);
}

.execution__exclu {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.execution__detail {
  display: grid;
  grid-template-columns: auto auto;
  gap: var(--gdv-espacement-4) var(--gdv-espacement-16);
  margin: 0;
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
  font-size: var(--gdv-role-etiquette);
}

.execution__detail dd {
  margin: 0;
  font-family: var(--gdv-famille-chiffres);
  font-variant-numeric: var(--gdv-chiffres-variant);
  text-align: end;
}
</style>
