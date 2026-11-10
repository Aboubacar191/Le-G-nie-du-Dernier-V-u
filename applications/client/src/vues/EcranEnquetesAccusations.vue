<script setup lang="ts">
// ECR-19 — Enquêtes et accusations. 60 s (US-09, US-10, RG-19, RG-26 à RG-28).
//
// SILENCE DE L'ENQUÊTE (M8, RG-27, CA-19) : la cible ne reçoit RIEN. Aucune
// notification, aucun compteur, aucune pastille, aucun changement sur sa carte,
// aucune vibration, aucun son. C'est ce silence qui rend le chantage possible.
// L'interface n'a donc AUCUNE entrée « enquêtes subies », et n'en aura jamais.
//
// COÛT ET RÔLE : le coût d'enquête vaut cout_enquete ou
// cout_enquete_inspecteur_tresor selon le rôle (RG-26). Un voisin qui lirait 1
// au lieu de 2 sur le bouton en déduirait l'INSPECTEUR_TRESOR. Le bouton public
// porte donc un libellé INVARIANT, et le coût exact se lit SOUS LE VOILE.
//
// VERDICT SANS AMPLEUR : le verdict est public immédiatement, mais l'ampleur du
// mensonge ne l'est pas avant l'EXECUTION (ADR-CP-06). La carte de l'accusé
// affiche donc le mot « Menteur » sans aucun chiffre.
//
// ÉTATS (DESIGN ECR-19)
// chargement   : cercle en squelette, bandeau déjà actif.
// contenu      : cercle sélectionnable, deux actions en pied séparées de 24,
//                les cartes non sélectionnables portant leur raison.
// vide         : non atteignable à 5 joueurs minimum. L'historique d'enquêtes
//                vide vit dans le panneau privé.
// erreur       : or insuffisant, cible déjà enquêtée, quota d'accusation
//                épuisé, refus serveur — et l'erreur rappelle TOUJOURS le
//                temps restant.
// acces_refuse : hors phase — actions désactivées avec raison.

import { computed, ref } from 'vue';

import SelecteurCible from '../composants/SelecteurCible.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import EcranConfirmationAccusation from './EcranConfirmationAccusation.vue';
import EcranResultatEnquete from './EcranResultatEnquete.vue';

const magasin = utiliserMagasin();

const accuseEnvisage = ref<string | null>(null);
const resultatOuvert = ref(false);

const moi = computed(() => magasin.etat.moi?.joueur_id ?? '');
const horsPhase = computed(() => magasin.etat.phase !== 'ENQUETES_ACCUSATIONS');
const solde = computed(() => magasin.etat.moi?.solde_pieces ?? 0);

/** Coût réel de MON enquête : il dépend de MON rôle, donc il est privé. */
const coutEnquete = computed((): number => {
  const config = magasin.etat.session?.config as {
    cout_enquete?: number;
    cout_enquete_inspecteur_tresor?: number;
  };
  return magasin.etat.moi?.role_secret === 'INSPECTEUR_TRESOR'
    ? config?.cout_enquete_inspecteur_tresor ?? 0
    : config?.cout_enquete ?? 0;
});

const coutFausseAccusation = computed((): number => {
  const config = magasin.etat.session?.config as { cout_fausse_accusation?: number };
  return config?.cout_fausse_accusation ?? 0;
});

const dejaEnquetee = (joueurId: string): boolean =>
  magasin.etat.resultats_enquete.some((resultat) => resultat.cible_joueur_id === joueurId);

/** Raisons d'indisponibilité, affichées sur la carte. Jamais un gris muet. */
const raisons = computed((): Record<string, string> => {
  const table: Record<string, string> = {};
  for (const joueur of magasin.etat.joueurs) {
    if (joueur.joueur_id === moi.value) table[joueur.joueur_id] = texte('carte_joueur.c_est_toi');
    else if (dejaEnquetee(joueur.joueur_id)) {
      table[joueur.joueur_id] = texte('carte_joueur.deja_enquete');
    }
  }
  return table;
});

const raisonBlocageEnquete = computed((): string => {
  if (horsPhase.value) return texte('ecran.enquetes.phase_passee');
  if (solde.value < coutEnquete.value) return texte('ecran.enquetes.or_insuffisant');
  return '';
});

const raisonBlocageAccusation = computed((): string => {
  if (horsPhase.value) return texte('ecran.enquetes.phase_passee');
  if (magasin.etat.moi?.a_accuse_cette_manche === true) {
    return texte('ecran.enquetes.quota_accusation');
  }
  return '';
});

function enqueter(cible: string): void {
  magasin.envoyer('lancer_enquete', { cible_joueur_id: cible });
  resultatOuvert.value = true;
}
</script>

<template>
  <section class="enquetes">
    <h2 class="enquetes__question">
      {{ texte('ecran.enquetes.question') }}
    </h2>

    <SelecteurCible
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="moi"
      variante="enquete"
      :declarations="magasin.etat.declarations"
      :raisons-indisponibles="raisons"
      :raison-blocage="raisonBlocageEnquete"
      @agir="enqueter"
    >
      <!-- Le COÛT est dans le voile : lu sur le bouton, il désignerait le rôle. -->
      <template #cout>
        <VoileSecret
          variante="lecture"
          :intitule="texte('ecran.enquetes.enqueter')"
        >
          <template #secret>
            <span class="enquetes__cout">
              {{ texte('ecran.enquetes.cout_sous_voile', { cout: coutEnquete }) }}
            </span>
            <ul class="enquetes__discretion">
              <li>{{ texte('ecran.enquetes.enquete_discretion_1') }}</li>
              <li>{{ texte('ecran.enquetes.enquete_discretion_2') }}</li>
              <li>{{ texte('ecran.enquetes.enquete_discretion_3') }}</li>
            </ul>
          </template>
        </VoileSecret>
      </template>
    </SelecteurCible>

    <!-- L'accusation est à l'opposé de l'enquête, séparée de espacement.24, et
         confirmée par dialogue : on ne peut pas accuser par erreur. -->
    <SelecteurCible
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="moi"
      variante="accusation"
      :declarations="magasin.etat.declarations"
      :raisons-indisponibles="raisons"
      :raison-blocage="raisonBlocageAccusation"
      @agir="(cible) => (accuseEnvisage = cible)"
    />

    <footer class="enquetes__regles">
      <p>{{ texte('ecran.enquetes.accusation_juste') }}</p>
      <p>{{ texte('ecran.enquetes.fausse_accusation', { cout: coutFausseAccusation }) }}</p>
    </footer>

    <!-- Aucun bouton « voir mon enquête » sur l'écran de fond : il n'existerait
         que chez l'enquêteur et le désignerait au voisin (M8). La feuille de
         résultat s'ouvre à l'instant de SON propre geste, et la relecture passe
         ensuite par le panneau privé, sous voile. -->
    <EcranResultatEnquete
      v-if="resultatOuvert"
      @fermer="resultatOuvert = false"
      @accuser="(cible) => { resultatOuvert = false; accuseEnvisage = cible; }"
    />

    <EcranConfirmationAccusation
      v-if="accuseEnvisage !== null"
      :accuse-joueur-id="accuseEnvisage"
      @fermer="accuseEnvisage = null"
    />
  </section>
</template>

<style scoped>
.enquetes {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  padding: var(--gdv-gouttiere-ecran);
}

.enquetes__question {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.enquetes__cout {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.enquetes__discretion {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: var(--gdv-espacement-8) 0 0;
  padding: 0;
  list-style: none;
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.enquetes__regles {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.enquetes__regles p {
  margin: 0;
}
</style>
