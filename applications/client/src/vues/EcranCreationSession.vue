<script setup lang="ts">
// ECR-02 — Création de session. Nommer l'hôte et créer la session. Les réglages
// d'équilibrage sont volontairement REPLIÉS : deux contacts suffisent à créer
// une partie, les valeurs vérifiées du jeu font le reste.
//
// jeton_session et jeton_groupe sont émis une seule fois ici, stockés
// localement, et JAMAIS affichés (ADR-TL-15).
//
// ÉTATS (DESIGN ECR-02)
// chargement   : après Créer, bouton en chargement et champ désactivé. Aucun
//                écran blanc intermédiaire.
// contenu      : un champ pseudo à libellé persistant, une bascule de mode
//                avancé avec sa raison si indisponible, un lien vers les
//                réglages, un bouton principal. Trois éléments actionnables.
// vide         : non atteignable — c'est un formulaire, il n'a rien à charger.
// erreur       : pseudo vide ou déjà pris, message SOUS le champ ; échec de
//                création, bandeau avec reprise et pseudo CONSERVÉ.
// acces_refuse : non atteignable.

import { computed, onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BasculeReglage from '../composants/BasculeReglage.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import ChampTexteCourt from '../composants/ChampTexteCourt.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin, utiliserStockage } from '../magasin/injection.ts';
import { ecrireJetonGroupe, relireJetonGroupe } from '../transport/stockage-jeton.ts';
import { creerSession, lireGroupeCourant } from '../transport/rest.ts';

const LONGUEUR_MAX_PSEUDO = 12;

const magasin = utiliserMagasin();
const stockage = utiliserStockage();

const pseudo = ref('');
const modeAvance = ref(false);
const chargement = ref(false);
const erreurChamp = ref('');
const erreurGlobale = ref('');
const partiesTerminees = ref(0);
const partiesRequises = ref(0);

const deblocageAcquis = computed(() => partiesTerminees.value >= partiesRequises.value);

onMounted(async () => {
  const jetonGroupe = relireJetonGroupe(stockage);
  if (jetonGroupe === null) return;
  const groupe = await lireGroupeCourant(jetonGroupe);
  if (!groupe.ok) return;
  partiesTerminees.value = groupe.valeur.parties_terminees;
  partiesRequises.value = groupe.valeur.parties_requises;
});

async function creer(): Promise<void> {
  erreurChamp.value = '';
  erreurGlobale.value = '';
  if (pseudo.value.trim() === '') {
    erreurChamp.value = texte('code_erreur.PSEUDO_INDISPONIBLE');
    return;
  }
  chargement.value = true;
  const resultat = await creerSession({
    pseudo: pseudo.value.trim(),
    jeton_groupe: relireJetonGroupe(stockage),
    // La surcharge réglée sur ECR-03 ne voyage QU'ICI : la configuration est
    // figée à la création, aucune commande ne la modifie ensuite (US-17).
    config_surchargee: magasin.surchargeEquilibrage(),
    activer_mode_avance: modeAvance.value,
  });
  chargement.value = false;

  if (!resultat.ok) {
    // Le pseudo est CONSERVÉ : le reperdre après un refus serveur ferait
    // ressaisir au joueur ce qu'il venait d'écrire.
    const cible = resultat.code === 'PSEUDO_INDISPONIBLE' ? erreurChamp : erreurGlobale;
    cible.value = texte(`code_erreur.${resultat.code}`, { pseudo: pseudo.value });
    return;
  }

  ecrireJetonGroupe(stockage, resultat.valeur.jeton_groupe);
  magasin.ouvrirSession({
    session_id: resultat.valeur.session_id,
    jeton_session: resultat.valeur.jeton_session,
    joueur_id: resultat.valeur.joueur_id,
    est_hote: true,
    url_temps_reel: resultat.valeur.url_temps_reel,
  });
  magasin.preremplirCode(resultat.valeur.code_adhesion);
  magasin.naviguer('invitation');
}
</script>

<template>
  <main class="creation">
    <h1 class="creation__titre">
      {{ texte('ecran.creation.titre') }}
    </h1>

    <BandeauAlerte
      v-if="erreurGlobale"
      variante="erreur"
      cle-contenu="ecran.creation.echec"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="erreurGlobale = ''"
    />

    <ChampTexteCourt
      v-model:valeur="pseudo"
      variante="pseudo"
      :libelle="texte('ecran.creation.libelle_pseudo')"
      :aide="texte('ecran.creation.aide_pseudo')"
      :erreur="erreurChamp"
      :desactive="chargement"
      :longueur-max="LONGUEUR_MAX_PSEUDO"
    />

    <BasculeReglage
      v-model:actif="modeAvance"
      :libelle="texte('ecran.creation.mode_avance')"
      :mot-actif="texte('ecran.salle_attente.mode_avance_actif')"
      :mot-inactif="texte('ecran.salle_attente.mode_avance_inactif')"
      :desactive="!deblocageAcquis"
      :raison="texte('ecran.creation.mode_avance_verrouille', { requises: partiesRequises })"
    />

    <BoutonAction
      :libelle="texte('ecran.creation.regler_equilibrage')"
      variante="discret"
      taille="md"
      @agir="magasin.naviguer('reglages')"
    />

    <BoutonAction
      :libelle="texte('ecran.creation.creer')"
      variante="principal"
      taille="lg"
      pleine-largeur
      :chargement="chargement"
      @agir="creer"
    />
  </main>
</template>

<style scoped>
.creation {
  display: flex;
  flex-direction: column;
  /* Écart entre deux champs : espacement.16 au minimum. */
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.creation__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}
</style>
