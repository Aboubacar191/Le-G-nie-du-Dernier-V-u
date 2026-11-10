<script setup lang="ts">
// ECR-05 — Rejoindre par code ou par QR (US-02).
//
// Par voie QR, le code est pré-rempli et verrouillé : il ne reste qu'à
// confirmer, un seul contact. « Corriger le code » le déverrouille.
//
// Le pseudo n'est PAS ressaisi ici (fidélité à la maquette) : il a été
// choisi une fois pour toutes à l'écran Bienvenue et repris en silence,
// exactement comme ECR-02. SEULE EXCEPTION : un lien ou QR d'adhésion peut
// amener un joueur qui n'a JAMAIS vu Bienvenue (routeur/index.ts route
// « /adhesion/:code » directement sur cet écran, sans passer par ECR-01).
// Dans ce seul cas, le champ pseudo réapparaît — sans lui, ce joueur ne
// pourrait tout simplement pas rejoindre.
//
// Le jeton reçu est stocké localement et JAMAIS affiché. Aucune liste de
// joueurs n'est montrée avant l'adhésion effective : avant d'avoir rejoint,
// rien ne justifie de connaître la table.
//
// ÉTATS (DESIGN ECR-05)
// chargement   : vérification du code, barre indéterminée sous le champ,
//                bouton en chargement, champ désactivé.
// contenu      : champ code à libellé persistant. Un seul bouton.
// vide         : non atteignable — c'est un formulaire.
// erreur       : code inconnu, partie pleine, partie déjà démarrée, pseudo
//                déjà pris. Chaque message NOMME l'action suivante.
// acces_refuse : session ABANDONNEE ou TERMINEE — cette partie est close.

import { computed, onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import ChampTexteCourt from '../composants/ChampTexteCourt.vue';
import EtatVide from '../composants/EtatVide.vue';
import ScannerQrAdhesion from '../composants/ScannerQrAdhesion.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import { apercevoirSession, rejoindreSession } from '../transport/rest.ts';

const LONGUEUR_CODE = 6;
const LONGUEUR_MAX_PSEUDO = 14;
const ETATS_CLOS = ['ABANDONNEE', 'TERMINEE'];

const magasin = utiliserMagasin();

const code = ref(magasin.codeAdhesionPrerempli());
// Repris de ECR-01 · Bienvenue. Absent si déjà choisi (fidélité maquette) ;
// ressaisi seulement pour le joueur arrivé directement par lien/QR (voir
// l'en-tête du fichier).
const pseudo = ref(magasin.pseudoPrerempli());
const pseudoAResaisir = pseudo.value.trim() === '';
const verrouille = ref(code.value.length === LONGUEUR_CODE);
const chargement = ref(false);
const erreurCode = ref('');
const erreurPseudo = ref('');
const close = ref(false);

const pretARejoindre = computed(
  () => code.value.length === LONGUEUR_CODE && pseudo.value.trim() !== '',
);

async function verifierCode(): Promise<void> {
  if (code.value.length !== LONGUEUR_CODE) return;
  const apercu = await apercevoirSession(code.value);
  if (!apercu.ok) return;
  close.value = ETATS_CLOS.includes(apercu.valeur.etat_partie);
  if (!apercu.valeur.peut_rejoindre && apercu.valeur.motif_refus !== null) {
    erreurCode.value = texte(`code_erreur.${apercu.valeur.motif_refus}`);
  }
}

/** QR décodé : même chemin que l'adhésion par URL, un seul contact restant. */
function surCodeScanne(codeDetecte: string): void {
  code.value = codeDetecte;
  verrouille.value = true;
  erreurCode.value = '';
  void verifierCode();
}

onMounted(verifierCode);

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
      <header class="rejoindre__entete">
        <button
          type="button"
          class="rejoindre__retour"
          :aria-label="texte('commun.retour_accueil')"
          @click="magasin.naviguer('accueil')"
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M15 10H5M9 5l-5 5 5 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h1 class="rejoindre__titre">
          {{ texte('ecran.rejoindre.titre') }}
        </h1>
      </header>

      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <template v-if="!verrouille">
        <ScannerQrAdhesion @code-detecte="surCodeScanne" />
        <p class="rejoindre__separateur">
          {{ texte('ecran.rejoindre.ou') }}
        </p>
      </template>

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
        v-if="pseudoAResaisir"
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

.rejoindre__entete {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
}

.rejoindre__retour {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--gdv-cible-minimale);
  block-size: var(--gdv-cible-minimale);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-principal);
  cursor: pointer;
}

.rejoindre__retour svg {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
}

.rejoindre__retour:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.rejoindre__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.rejoindre__separateur {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  text-align: center;
}
</style>
