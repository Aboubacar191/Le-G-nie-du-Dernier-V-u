<script setup lang="ts">
// ECR-05 — Rejoindre par code ou par QR (US-02).
//
// Par voie QR, le code est pré-rempli et verrouillé : il ne reste que le
// pseudo, soit un seul contact. « Corriger le code » le déverrouille.
//
// Le jeton reçu est stocké localement et JAMAIS affiché. Aucune liste de
// joueurs n'est montrée avant l'adhésion effective : avant d'avoir rejoint,
// rien ne justifie de connaître la table.
//
// ÉTATS (DESIGN ECR-05)
// chargement   : vérification du code, barre indéterminée sous le champ,
//                bouton en chargement, champs désactivés.
// contenu      : deux champs à libellés persistants, écart libellé-champ 4 et
//                écart entre champs 16. Un seul bouton.
// vide         : non atteignable — c'est un formulaire.
// erreur       : code inconnu, partie pleine, partie déjà démarrée, pseudo
//                déjà pris. Chaque message NOMME l'action suivante.
// acces_refuse : session ABANDONNEE ou TERMINEE — cette partie est close.

import { computed, onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import ChampTexteCourt from '../composants/ChampTexteCourt.vue';
import EtatVide from '../composants/EtatVide.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import { apercevoirSession, rejoindreSession } from '../transport/rest.ts';

const LONGUEUR_CODE = 6;
const LONGUEUR_MAX_PSEUDO = 12;
const ETATS_CLOS = ['ABANDONNEE', 'TERMINEE'];

const magasin = utiliserMagasin();

const code = ref(magasin.codeAdhesionPrerempli());
const pseudo = ref('');
const verrouille = ref(code.value.length === LONGUEUR_CODE);
const chargement = ref(false);
const erreurCode = ref('');
const erreurPseudo = ref('');
const close = ref(false);

const pretARejoindre = computed(
  () => code.value.length === LONGUEUR_CODE && pseudo.value.trim() !== '',
);

onMounted(async () => {
  if (code.value.length !== LONGUEUR_CODE) return;
  const apercu = await apercevoirSession(code.value);
  if (!apercu.ok) return;
  close.value = ETATS_CLOS.includes(apercu.valeur.etat_partie);
  if (!apercu.valeur.peut_rejoindre && apercu.valeur.motif_refus !== null) {
    erreurCode.value = texte(`code_erreur.${apercu.valeur.motif_refus}`);
  }
});

function classerErreur(code_: string): void {
  const cible = code_ === 'PSEUDO_INDISPONIBLE' ? erreurPseudo : erreurCode;
  cible.value = texte(`code_erreur.${code_}`);
}

async function rejoindre(): Promise<void> {
  erreurCode.value = '';
  erreurPseudo.value = '';
  chargement.value = true;
  const resultat = await rejoindreSession(code.value, pseudo.value.trim());
  chargement.value = false;

  if (!resultat.ok) {
    classerErreur(resultat.code);
    return;
  }
  magasin.ouvrirSession({
    session_id: resultat.valeur.session_id,
    jeton_session: resultat.valeur.jeton_session,
    joueur_id: resultat.valeur.joueur_id,
    est_hote: false,
    url_temps_reel: resultat.valeur.url_temps_reel,
  });
}
</script>

<template>
  <main class="rejoindre">
    <EtatVide
      v-if="close"
      :titre="texte('ecran.rejoindre.close')"
      :action-libelle="texte('commun.retour_accueil')"
      @agir="magasin.naviguer('accueil')"
    />

    <template v-else>
      <h1 class="rejoindre__titre">
        {{ texte('ecran.rejoindre.titre') }}
      </h1>

      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <ChampTexteCourt
        v-model:valeur="code"
        variante="code_adhesion"
        :libelle="texte('ecran.rejoindre.libelle_code')"
        :aide="texte('ecran.rejoindre.aide_code', { longueur: LONGUEUR_CODE })"
        :erreur="erreurCode"
        :desactive="chargement || verrouille"
        :chargement="chargement"
        :longueur-max="LONGUEUR_CODE"
      />

      <BoutonAction
        v-if="verrouille"
        :libelle="texte('ecran.rejoindre.corriger_code')"
        variante="discret"
        taille="md"
        @agir="verrouille = false"
      />

      <ChampTexteCourt
        v-model:valeur="pseudo"
        variante="pseudo"
        :libelle="texte('ecran.creation.libelle_pseudo')"
        :aide="texte('ecran.creation.aide_pseudo')"
        :erreur="erreurPseudo"
        :desactive="chargement"
        :longueur-max="LONGUEUR_MAX_PSEUDO"
      />

      <BoutonAction
        :libelle="texte('ecran.rejoindre.rejoindre')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="!pretARejoindre"
        :raison="texte('ecran.rejoindre.aide_code', { longueur: LONGUEUR_CODE })"
        :chargement="chargement"
        @agir="rejoindre"
      />
    </template>
  </main>
</template>

<style scoped>
.rejoindre {
  display: flex;
  flex-direction: column;
  /* Écart entre deux champs : espacement.16. Le clavier logiciel couvre au plus
     la moitié basse, les deux champs et le bouton restent visibles à 360×640. */
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.rejoindre__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}
</style>
