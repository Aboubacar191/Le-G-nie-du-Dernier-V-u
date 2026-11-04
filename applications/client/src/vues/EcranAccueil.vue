<script setup lang="ts">
// ECR-01 — orchestrateur du parcours d'entrée A → B → C (voir le commentaire
// sur etapeEntree plus bas). L'étape C elle-même est composants/AccueilMenu.vue ;
// ce fichier ne fait plus que porter l'état partagé entre les trois étapes.
//
// ÉTATS (DESIGN ECR-01), rendus par composants/AccueilMenu.vue (étape C) :
// chargement   : vérification d'un éventuel jeton stocké. Les deux cartes sont
//                affichées dès le premier rendu ; seule l'entrée « Reprendre ma
//                partie » arrive en squelette. L'écran n'est jamais vide.
// contenu      : en-tête personnalisé, citation, cartes Créer/Rejoindre,
//                progression du Dernier Vœu, règle d'or.
// vide         : non atteignable depuis cette page — accueil n'a rien à
//                charger qui puisse être vide ; les cartes sont toujours la
//                sortie, nominal ou non.
// erreur       : serveur injoignable. Les deux cartes restent AFFICHÉES mais
//                désactivées, avec la raison : les masquer ferait chercher.
// acces_refuse : non atteignable — l'accueil n'exige aucun droit.
//
// ANO-UX-01 (majeur, trouvé par l'utilisateur en trois minutes de test réel)
// La sonde ne tirait QU'UNE FOIS au montage et figeait `serveurInjoignable`.
// L'utilisateur a chargé la page pendant une panne : les deux boutons sont
// restés morts, sans jamais revérifier, et il a conclu que l'application était
// cassée. La sonde est désormais périodique, avec reprise automatique dès que le
// serveur répond — voir composables/sonde-sante.ts. Trois conséquences ici :
//   · l'état « inconnu » (première réponse pas encore arrivée) n'est PAS traité
//     comme une panne : annoncer « le génie ne répond pas » avant d'avoir
//     attendu la réponse serait un faux négatif, et c'est ce faux négatif qui
//     fait conclure que l'application est cassée ;
//   · la reprise du bandeau SONDE réellement, au lieu de masquer le bandeau —
//     elle ne faisait que cacher le symptôme ;
//   · rien ici ne « répare » : la sonde publie un état, l'écran l'affiche.

import { onMounted, computed, ref } from 'vue';

import AccueilBienvenue from '../composants/AccueilBienvenue.vue';
import AccueilMenu from '../composants/AccueilMenu.vue';
import BadgeLampe from '../composants/BadgeLampe.vue';
import { utiliserSondeSante } from '../composables/sonde-sante.ts';
import { texte } from '../logique/contenu.ts';
import { COULEURS_JOUEUR } from '../logique/couleurs-joueur.ts';
import { utiliserMagasin, utiliserStockage } from '../magasin/injection.ts';
import { appliquerTheme, ecrireTheme, relireTheme, type ChoixTheme } from '../magasin/preferences.ts';
import { relireJetonGroupe } from '../transport/stockage-jeton.ts';
import { lireGroupeCourant } from '../transport/rest.ts';

const magasin = utiliserMagasin();
const stockage = utiliserStockage();
const sonde = utiliserSondeSante();

const chargement = ref(true);
const jetonPresent = ref(false);

// Même source que EcranCreationSession.vue (ECR-03) : la progression du
// groupe vers le Dernier Vœu. Dupliqué plutôt que partagé par composable pour
// ne pas élargir le périmètre de cette page au refactor d'un écran existant.
const partiesTerminees = ref(0);
const partiesRequises = ref(0);

// Thème clair/sombre : app.vue applique déjà la préférence stockée au montage
// (RACINE-HORS-COMPOSANT, sur document.documentElement). Ce bouton n'ajoute
// qu'un DEUXIÈME point d'écriture, sur le MÊME stockage et la MÊME fonction
// appliquerTheme — jamais une seconde logique divergente.
const themeActuel = ref<ChoixTheme>(relireTheme(stockage));
function basculerTheme(): void {
  const suivant: ChoixTheme = themeActuel.value === 'sombre' ? 'clair' : 'sombre';
  themeActuel.value = suivant;
  ecrireTheme(stockage, suivant);
  appliquerTheme(globalThis.document.documentElement, suivant);
}

// ECR-01 s'ouvre désormais sur le parcours A → B → C du prototype, en trois
// états purement locaux à CE composant (aucun des trois n'est une intention
// de navigation du contrat — resolution-ecran.ts n'en sait rien, et c'est
// voulu : le contrat de conception ferme la liste à 32 écrans, « sans
// exception ni ajout » (vues/index.ts) ; A et B ne sont pas des écrans
// nouveaux, ce sont des états internes du même ECR-01) :
//  · lancement  — A, badge+titre+invite, aucun bouton, tapotement plein écran ;
//  · bienvenue  — B, pseudo + aperçu d'avatar + couleur, UNE SEULE FOIS par
//    ouverture (non persisté, comme A) ;
//  · accueil    — C, le contenu existant (Rejoindre / Créer / réglages).
// Non persisté à dessein : le parcours rejoue à chaque ouverture de l'appli,
// pas seulement à la première — « Lancement de l'appli », pas « Premier
// lancement ».
/** Identique à LONGUEUR_MAX_PSEUDO de EcranCreationSession/EcranRejoindre. */
const LONGUEUR_MAX_PSEUDO = 12;

type EtapeEntree = 'lancement' | 'bienvenue' | 'accueil';
const etapeEntree = ref<EtapeEntree>('lancement');

function franchirLancement(): void {
  etapeEntree.value = 'bienvenue';
}

// État de B, local : le pseudo n'est confirmé dans le magasin qu'à la sortie
// de cette étape (preremplirPseudo), pour que ECR-02/05 le reprennent sans
// ressaisie. La couleur, elle, ne quitte jamais ce composant — voir
// composants/SelecteurCouleurJoueur.vue.
const pseudoBienvenue = ref(magasin.pseudoPrerempli());
const couleurBienvenue = ref(magasin.couleurPrerempli() || (COULEURS_JOUEUR[0]?.id ?? ''));
const erreurPseudoBienvenue = ref('');

function entrerDansLaCite(): void {
  const valeur = pseudoBienvenue.value.trim();
  if (valeur === '') {
    erreurPseudoBienvenue.value = texte('ecran.accueil.bienvenue_pseudo_requis');
    return;
  }
  erreurPseudoBienvenue.value = '';
  magasin.preremplirPseudo(valeur);
  magasin.preremplirCouleur(couleurBienvenue.value);
  etapeEntree.value = 'accueil';
}

/** Seul l'état MESURÉ « injoignable » bloque. « inconnu » ne bloque rien. */
const serveurInjoignable = computed(() => sonde.etat.value === 'injoignable');
const raisonIndisponible = computed(() =>
  serveurInjoignable.value ? texte('ecran.accueil.serveur_injoignable') : '',
);

onMounted(async () => {
  // L'entrée « Reprendre ma partie » n'apparaît que si un jeton est mémorisé :
  // proposer de reprendre une partie qui n'existe pas mène à l'écran de refus.
  jetonPresent.value = magasin.jetonMemorise();
  chargement.value = false;

  const jetonGroupe = relireJetonGroupe(stockage);
  if (jetonGroupe === null) return;
  const groupe = await lireGroupeCourant(jetonGroupe);
  if (!groupe.ok) return;
  partiesTerminees.value = groupe.valeur.parties_terminees;
  partiesRequises.value = groupe.valeur.parties_requises;
});

function reprendre(): void {
  if (!magasin.reprendre()) jetonPresent.value = false;
}
</script>

<template>
  <!-- ECR-01-A · Lancement — reproduit à l'identique de
       reference-prototype/a-lancement-de-l-appli.ecran.html : badge, titre,
       accroche, trois pastilles (portées par BadgeLampe), invite tactile,
       effectif. AUCUN bouton sur cet écran, comme dans la référence : toute la
       surface est une seule cible de tapotement (le prototype l'exprime par un
       <a> englobant ; ici un <button> plein, pour garder un élément natif
       accessible au clavier sans rôle ARIA à maintenir à la main). -->
  <main
    v-if="etapeEntree === 'lancement'"
    class="accueil accueil--lancement"
  >
    <button
      type="button"
      class="accueil__lancement"
      :aria-label="texte('ecran.accueil.lancement_invite')"
      @click="franchirLancement"
    >
      <BadgeLampe :titre-adjacent="true" />
      <div class="accueil__bloc-titre">
        <h1 class="accueil__titre">
          {{ texte('commun.titre_application') }}
        </h1>
        <p class="accueil__accroche">
          {{ texte('ecran.accueil.lancement_accroche') }}
        </p>
      </div>
      <p class="accueil__invite">
        {{ texte('ecran.accueil.lancement_invite') }}
      </p>
      <p class="accueil__effectif">
        {{ texte('ecran.accueil.lancement_effectif') }}
      </p>
    </button>
  </main>

  <!-- ECR-01-B · Bienvenue — voir composants/AccueilBienvenue.vue. -->
  <main
    v-else-if="etapeEntree === 'bienvenue'"
    class="accueil"
  >
    <AccueilBienvenue
      v-model:pseudo="pseudoBienvenue"
      v-model:couleur="couleurBienvenue"
      :erreur-pseudo="erreurPseudoBienvenue"
      :longueur-max-pseudo="LONGUEUR_MAX_PSEUDO"
      @entrer="entrerDansLaCite"
    />
  </main>

  <!-- ECR-01-C · Accueil — voir composants/AccueilMenu.vue. -->
  <main
    v-else
    class="accueil"
  >
    <AccueilMenu
      :pseudo="magasin.pseudoPrerempli()"
      :couleur-id="magasin.couleurPrerempli()"
      :theme="themeActuel"
      :serveur-injoignable="serveurInjoignable"
      :raison-indisponible="raisonIndisponible"
      :chargement="chargement"
      :jeton-present="jetonPresent"
      :parties-terminees="partiesTerminees"
      :parties-requises="partiesRequises"
      @rejoindre="magasin.naviguer('adhesion')"
      @creer="magasin.naviguer('creation')"
      @reprendre="reprendre"
      @relancer-sonde="sonde.relancer()"
      @basculer-theme="basculerTheme"
    />
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

/* ECR-01-A · Lancement — mise en page de reference-prototype/
   a-lancement-de-l-appli.ecran.html, rendue avec les jetons d'espacement
   existants les plus proches de ses valeurs (aucun jeton n'est créé ici). */
.accueil--lancement {
  padding: 0;
}

.accueil__lancement {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gdv-espacement-24);
  inline-size: 100%;
  min-block-size: 100vh;
  padding: var(--gdv-espacement-48) var(--gdv-espacement-32);
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.accueil__lancement:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: calc(-1 * var(--gdv-espacement-8));
}

.accueil__bloc-titre {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-8);
}

.accueil__accroche {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  line-height: var(--gdv-interligne-courant);
}

.accueil__invite {
  margin: 0;
  color: var(--gdv-texte-principal);
  font-size: var(--gdv-role-etiquette);
  letter-spacing: var(--gdv-suivi-titre);
}

.accueil__effectif {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
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

</style>
