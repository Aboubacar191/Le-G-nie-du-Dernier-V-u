<script setup lang="ts">
// ECR-03 — Réglages d'équilibrage de l'hôte (US-17, CA-45).
//
// Un encart d'avertissement PERMANENT accompagne l'écran : ces valeurs sont
// vérifiées par le concepteur du jeu, les modifier change l'équilibre. On
// avertit, on n'empêche pas.
//
// Les paramètres sont découpés en sections de 3 à 5 (Miller), jamais une liste
// unique de 21 champs. Toute valeur se saisit à l'incrémenteur : il n'y a
// aucun clavier numérique dans l'application, pas même ici (RG-78).
//
// Les réglages sont FIGÉS dès que la partie commence : la surcharge voyage dans
// le corps de POST /sessions, et aucune commande ne la modifie ensuite
// (commandes_inexistantes_par_conception).
//
// ÉTATS (DESIGN ECR-03)
// chargement   : lecture de la configuration par défaut, squelette par ligne
//                aux dimensions des incrémenteurs.
// contenu      : sections repliables de 3 à 5 paramètres, chacune portant sa
//                valeur courante et la valeur vérifiée du jeu.
// vide         : non atteignable — la configuration a toujours des défauts.
// erreur       : valeur hors bornes, le pas concerné passe en borne_atteinte ;
//                refus serveur, valeur précédente conservée.
// acces_refuse : non-hôte, ou session déjà démarrée. Chaque cas a sa sortie.

import { onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import { texte } from '../logique/contenu.ts';
import { bornes } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import { lireConfigurationParDefaut } from '../transport/rest.ts';

/** Sections du contrat de conception : 3 à 5 paramètres chacune (Miller). */
const SECTIONS = [
  { cle: 'ecran.reglages.section_monnaie', champs: ['pieces_initiales', 'objectif_par_joueur', 'nb_manches'] },
  {
    cle: 'ecran.reglages.section_recompenses',
    champs: ['multiplicateur_recompense', 'multiplicateur_recompense_tresor_honnetes'],
  },
  {
    cle: 'ecran.reglages.section_enquetes',
    champs: [
      'cout_enquete',
      'cout_enquete_inspecteur_tresor',
      'multiplicateur_amende',
      'cout_fausse_accusation',
      'accusations_max_par_joueur_par_manche',
    ],
  },
  {
    cle: 'ecran.reglages.section_prets',
    champs: ['bonus_mission_reussie', 'bonus_marchand_epices_par_voeu_reussi'],
  },
  {
    cle: 'ecran.reglages.section_dernier_voeu',
    champs: ['recompense_signature_dernier_voeu', 'parties_requises_pour_debloquer_dernier_voeu'],
  },
] as const;

const PLAFOND_REGLAGE = 100;

const magasin = utiliserMagasin();

const chargement = ref(true);
const erreur = ref(false);
const defauts = ref<Record<string, number>>({});
const valeurs = ref<Record<string, number>>({});
const depliees = ref<Record<string, boolean>>({});

onMounted(async () => {
  const resultat = await lireConfigurationParDefaut();
  chargement.value = false;
  if (!resultat.ok) {
    erreur.value = true;
    return;
  }
  const config = resultat.valeur.config_par_defaut as unknown as Record<string, unknown>;
  const numeriques: Record<string, number> = {};
  for (const section of SECTIONS) {
    for (const champ of section.champs) {
      const valeur = config[champ];
      if (typeof valeur === 'number') numeriques[champ] = valeur;
    }
  }
  defauts.value = numeriques;
  valeurs.value = { ...numeriques };
});

/** Les réglages sont figés dès que la partie commence (étatde session connu). */
const figes = (): boolean => magasin.etat.session !== null;

function retablir(): void {
  valeurs.value = { ...defauts.value };
}

function appliquer(): void {
  // La surcharge est transmise à la CRÉATION de session (POST /sessions). Il
  // n'existe aucune commande de modification de configuration : le contrat
  // l'exclut explicitement, et l'écran ne peut donc pas en émettre une.
  magasin.preremplirCode('');
  magasin.naviguer('creation');
}
</script>

<template>
  <main class="reglages">
    <EtatVide
      v-if="figes()"
      :titre="texte('ecran.reglages.acces_refuse_demarree')"
      :action-libelle="texte('ecran.reglages.revenir_cercle')"
      @agir="magasin.naviguer('accueil')"
    />

    <template v-else>
      <h1 class="reglages__titre">
        {{ texte('ecran.reglages.titre') }}
      </h1>

      <!-- Encart permanent, variante avertissement. Il informe du coût du
           réglage sans empêcher l'action. -->
      <BandeauAlerte
        variante="avertissement"
        cle-contenu="ecran.reglages.avertissement"
      />

      <BandeauAlerte
        v-if="erreur"
        variante="erreur"
        cle-contenu="code_erreur.ERREUR_INTERNE"
        :action-libelle="texte('commun.reessayer')"
        @reprendre="erreur = false"
      />

      <SqueletteChargement
        v-if="chargement"
        :lignes="SECTIONS.length"
        hauteur="var(--gdv-hauteur-pas-incrementeur)"
        :libelle="texte('commun.chargement')"
      />

      <section
        v-for="section in SECTIONS"
        v-else
        :key="section.cle"
        class="reglages__section"
      >
        <h2 class="reglages__section-titre">
          <button
            type="button"
            class="reglages__deplier"
            :aria-expanded="depliees[section.cle] === true"
            @click="depliees[section.cle] = !depliees[section.cle]"
          >
            {{ texte(section.cle) }}
          </button>
        </h2>

        <div
          v-if="depliees[section.cle]"
          class="reglages__champs"
        >
          <div
            v-for="champ in section.champs"
            :key="champ"
            class="reglages__champ"
          >
            <p class="reglages__libelle">
              {{ texte(`config_libelle.${champ}`) }}
            </p>
            <IncrementeurMontant
              :valeur="valeurs[champ] ?? 0"
              :bornes="bornes(0, PLAFOND_REGLAGE)"
              variante="compact"
              :intitule="texte(`config_libelle.${champ}`)"
              @update:valeur="(nouvelle) => (valeurs[champ] = nouvelle)"
            />
            <p class="reglages__verifiee">
              {{ texte('ecran.reglages.valeur_verifiee', { valeur: defauts[champ] ?? 0 }) }}
            </p>
          </div>
        </div>
      </section>

      <div class="reglages__actions">
        <BoutonAction
          :libelle="texte('ecran.reglages.retablir')"
          variante="secondaire"
          taille="md"
          @agir="retablir"
        />
        <BoutonAction
          :libelle="texte('ecran.reglages.appliquer')"
          variante="principal"
          taille="md"
          @agir="appliquer"
        />
        <BoutonAction
          :libelle="texte('commun.annuler')"
          variante="discret"
          taille="md"
          @agir="magasin.naviguer('accueil')"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.reglages {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.reglages__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.reglages__section {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
}

.reglages__section-titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.reglages__deplier {
  inline-size: 100%;
  min-block-size: var(--gdv-cible-minimale);
  border: none;
  background: none;
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-titre-section);
  text-align: start;
  cursor: pointer;
}

.reglages__deplier:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.reglages__champs {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.reglages__champ {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.reglages__libelle {
  margin: 0;
  font-size: var(--gdv-role-corps);
}

.reglages__verifiee {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.reglages__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-12);
  margin-block-start: auto;
}
</style>
