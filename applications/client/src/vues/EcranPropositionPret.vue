<script setup lang="ts">
// ECR-14 — Proposition de prêt, PRETEUR seul (RG-29, CA-33).
//
// Monopole du PRETEUR : prêter avec intérêts, remboursé d'office à l'exécution
// de la manche suivante.
//
// Cet écran est atteint depuis l'INTÉRIEUR de la feuille de transfert, pour que
// l'écran de fond reste identique chez tous : le rôle ne se lit pas sur une
// silhouette d'interface.
//
// Le montant du remboursement est AFFICHÉ, sous voile, en même temps que le
// principal. Le joueur ne calcule pas de tête un arrondi supérieur pendant une
// phase minutée. La valeur vient du serveur par du_total dès que le prêt est
// proposé ; avant soumission, le taux de la configuration publique sert à
// l'informer — c'est de l'affichage, pas une règle de jeu.
//
// ÉTATS (DESIGN ECR-14)
// chargement   : cibles en squelette, bouton en chargement à la soumission.
// contenu      : emprunteur, principal sous voile, remboursement sous voile.
// vide         : aucun emprunteur joignable.
// erreur       : solde insuffisant (borne_atteinte) ; prêt déjà en cours avec
//                cette cible ; refus serveur, feuille maintenue et saisie
//                conservée.
// acces_refuse : non-PRETEUR — la sortie propose le transfert simple.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import CarteJoueurCercle from '../composants/CarteJoueurCercle.vue';
import EtatVide from '../composants/EtatVide.vue';
import FeuilleModale from '../composants/FeuilleModale.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { bornes, raccourcisTransfert } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ fermer: [] }>();

const magasin = utiliserMagasin();

const emprunteur = ref<string | null>(null);
const principal = ref(1);
const envoi = ref(false);

const preteur = computed(() => magasin.etat.moi?.role_secret === 'PRETEUR');
const solde = computed(() => magasin.etat.moi?.solde_pieces ?? 0);
const limites = computed(() => bornes(1, solde.value));
const raccourcis = computed(() => raccourcisTransfert(limites.value, solde.value));

const cibles = computed(() =>
  magasin.etat.joueurs.filter((joueur) => joueur.joueur_id !== magasin.etat.moi?.joueur_id),
);

/** Un prêt est déjà en cours avec cette cible : le serveur le refuserait. */
function dejaPrete(joueurId: string): boolean {
  return magasin.etat.prets.some(
    (pret) => pret.emprunteur_joueur_id === joueurId && pret.statut === 'ACTIF',
  );
}

/**
 * Remboursement attendu, lu dans la configuration PUBLIQUE de la session. Ce
 * n'est pas un calcul de règle : c'est l'affichage d'un taux que toute la table
 * connaît. L'autorité du montant réel reste au serveur, qui renvoie du_total.
 */
const remboursement = computed((): number => {
  const config = magasin.etat.session?.config as { taux_interet_pret?: readonly number[] };
  const taux = config?.taux_interet_pret;
  if (taux === undefined || taux.length !== 2) return principal.value;
  const [numerateur, denominateur] = taux as readonly [number, number];
  if (denominateur === 0) return principal.value;
  return Math.ceil(principal.value * (1 + numerateur / denominateur));
});

function proposer(): void {
  if (emprunteur.value === null) return;
  envoi.value = true;
  magasin.envoyer('proposer_pret', {
    emprunteur_joueur_id: emprunteur.value,
    principal: principal.value,
  });
  envoi.value = false;
}
</script>

<template>
  <FeuilleModale
    :titre="texte('ecran.pret.titre_proposer')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <EtatVide
      v-if="!preteur"
      :titre="texte('ecran.pret.acces_refuse')"
      :action-libelle="texte('ecran.pret.transfert_simple')"
      @agir="emettre('fermer')"
    />

    <template v-else>
      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <EtatVide
        v-if="cibles.length === 0"
        :titre="texte('ecran.pret.aucun_emprunteur')"
        :action-libelle="texte('commun.fermer')"
        @agir="emettre('fermer')"
      />

      <template v-else>
        <p class="pret__etiquette">
          {{ texte('ecran.pret.libelle_emprunteur') }}
        </p>
        <ul class="pret__cibles">
          <li
            v-for="joueur in cibles"
            :key="joueur.joueur_id"
          >
            <CarteJoueurCercle
              :pseudo="joueur.pseudo"
              :position-cercle="joueur.position_cercle"
              :connecte="joueur.connecte"
              variante="selectionnable"
              :selectionnee="emprunteur === joueur.joueur_id"
              :raison-indisponible="dejaPrete(joueur.joueur_id) ? texte('ecran.pret.deja_en_cours') : ''"
              @choisir="emprunteur = joueur.joueur_id"
            />
          </li>
        </ul>

        <!-- Principal ET remboursement calculé, tous deux sous voile. -->
        <VoileSecret
          variante="saisie"
          :intitule="texte('ecran.pret.principal')"
        >
          <template #secret>
            <span class="pret__remboursement">
              {{ texte('ecran.pret.remboursement', { du_total: remboursement }) }}
            </span>
          </template>
          <template #saisie>
            <IncrementeurMontant
              v-model:valeur="principal"
              :bornes="limites"
              variante="secret"
              :raccourcis="raccourcis"
              :desactive="envoi"
              :intitule="texte('ecran.pret.principal')"
            />
          </template>
        </VoileSecret>

        <BoutonAction
          :libelle="texte('ecran.pret.proposer')"
          variante="principal"
          taille="lg"
          pleine-largeur
          :desactive="emprunteur === null || envoi"
          :raison="texte('ecran.transfert.choisis_cible')"
          :chargement="envoi"
          @agir="proposer"
        />
        <BoutonAction
          :libelle="texte('commun.annuler')"
          variante="discret"
          taille="md"
          @agir="emettre('fermer')"
        />
      </template>
    </template>
  </FeuilleModale>
</template>

<style scoped>
.pret__etiquette {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.pret__cibles {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pret__remboursement {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-meta);
  text-align: center;
}
</style>
