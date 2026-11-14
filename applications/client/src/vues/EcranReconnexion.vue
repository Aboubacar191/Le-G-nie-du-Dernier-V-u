<script setup lang="ts">
// ECR-30 — Reconnexion et restitution (RG-73, CA-42).
//
// Restituer exactement l'état du joueur, sans qu'aucun secret d'autrui ne
// transite, et SANS réafficher ses propres secrets sans geste.
//
// RG-73 : le serveur renvoie l'état projeté pour ce joueur seul. La règle
// complémentaire d'interface est M1 : la restitution n'ouvre AUCUN voile. Un
// joueur qui retrouve son téléphone après l'avoir posé sur la table ne doit pas
// y trouver son rôle affiché en clair.
//
// Le résumé d'absence est strictement limité aux événements PUBLICS : phases
// traversées, déclarations publiées, révélations émises, accusations et
// verdicts, résultats d'exécution. Jamais un acte secret, même le sien : son
// propre paiement est restitué comme SCELLÉ, sans chiffre.
//
// ÉTATS (DESIGN ECR-30)
// chargement   : squelette de l'écran de phase cible, aux dimensions finales,
//                « Le génie te remet dans le cercle ».
// contenu      : résumé des événements publics manqués, puis « Reprendre ».
// vide         : rien manqué (coupure de moins d'une seconde) — reprise directe
//                et silencieuse, aucun écran intermédiaire.
// erreur       : jeton refusé, ECR-32 ; état incohérent, reprise puis sortie
//                vers l'accueil après trois échecs.
// acces_refuse : partie terminée ou abandonnée pendant l'absence — redirection
//                vers les scores ou vers l'écran d'abandon.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ reprendre: [] }>();

const magasin = utiliserMagasin();
const resumeOuvert = ref(false);

const LIGNES_SQUELETTE = 4;

const projectionRecue = computed(() => magasin.etat.session !== null);

/**
 * Résumé d'absence, construit UNIQUEMENT depuis l'historique public projeté.
 * Aucune entrée ne vient d'un champ privé, pas même des miens : mon paiement
 * figure comme « scellé », sans valeur.
 */
const resume = computed((): readonly string[] => {
  const lignes: string[] = [];
  for (const manche of magasin.etat.historique_manches) {
    for (const declaration of manche.declarations) {
      lignes.push(
        texte('ecran.reconnexion.declaration_publiee', {
          pseudo: pseudoDe(magasin.etat, declaration.joueur_id),
          montant: declaration.montant_declare,
        }),
      );
    }
    for (const accusation of manche.accusations) {
      lignes.push(
        texte('ecran.reconnexion.accusation', {
          accusateur: pseudoDe(magasin.etat, accusation.accusateur_joueur_id),
          accuse: pseudoDe(magasin.etat, accusation.accuse_joueur_id),
          verdict: texte(`verdict.${accusation.verdict}`),
        }),
      );
    }
    if (manche.revelations.length > 0) lignes.push(texte('ecran.reconnexion.revelation_emise'));
    if (manche.cloture) {
      lignes.push(
        texte('ecran.reconnexion.execution', {
          manche: manche.numero,
          resultat: manche.reussi === true
            ? texte('ecran.execution.reussi')
            : texte('ecran.execution.echoue'),
        }),
      );
    }
  }
  return lignes;
});

const rienManque = computed(() => resume.value.length === 0);
</script>

<template>
  <main class="reconnexion">
    <SqueletteChargement
      v-if="!projectionRecue"
      :lignes="LIGNES_SQUELETTE"
      hauteur="var(--gdv-hauteur-ligne-tableau)"
      :libelle="texte('genie.remet_dans_le_cercle')"
    />

    <template v-else>
      <BulleGenie
        variante="annonce"
        :phrase="texte('ecran.reconnexion.titre')"
      />

      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <!-- Mon propre paiement est restitué SANS CHIFFRE. -->
      <p
        v-if="magasin.etat.paiement_scelle"
        class="reconnexion__scelle"
      >
        {{ texte('ecran.reconnexion.mon_paiement_scelle') }}
      </p>

      <BoutonAction
        v-if="!rienManque"
        :libelle="texte('ecran.reconnexion.lire_manque')"
        variante="secondaire"
        taille="md"
        @agir="resumeOuvert = !resumeOuvert"
      />

      <ul
        v-if="resumeOuvert && !rienManque"
        class="reconnexion__resume"
      >
        <li
          v-for="(ligne, index) in resume"
          :key="index"
        >
          {{ ligne }}
        </li>
      </ul>
      <p
        v-else-if="rienManque"
        class="reconnexion__vide"
      >
        {{ texte('ecran.reconnexion.resume_vide') }}
      </p>

      <BoutonAction
        :libelle="texte('ecran.reconnexion.reprendre')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="emettre('reprendre')"
      />
    </template>
  </main>
</template>

<style scoped>
.reconnexion {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.reconnexion__scelle {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.reconnexion__resume {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  margin: 0;
  padding-inline-start: var(--gdv-espacement-16);
  font-size: var(--gdv-role-etiquette);
  line-height: var(--gdv-interligne-courant);
}

.reconnexion__vide {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
}
</style>
