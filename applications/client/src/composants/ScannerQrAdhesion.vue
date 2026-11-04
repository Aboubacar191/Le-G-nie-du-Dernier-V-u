<script setup lang="ts">
// Scanner QR — écran E du prototype (reference-prototype/
// e-rejoindre-une-partie.ecran.html), cadre de visée avec quatre coins.
//
// ZÉRO NOUVELLE DÉPENDANCE : BarcodeDetector est une API native du navigateur
// (pas de bibliothèque de décodage embarquée). Pas de v-html : le flux vidéo
// est un élément <video> natif, jamais du balisage injecté.
//
// Le code scanné est extrait avec la MÊME regex que le routeur
// (routeur/index.ts, MOTIF_ADHESION) : un QR qui n'encode pas une URL
// d'adhésion reconnue est silencieusement ignoré, jamais interprété au hasard.
//
// DEGRADATION ASSUMÉE, pas masquée : getUserMedia exige un contexte
// sécurisé (HTTPS ou localhost strict). Testé en développement sur
// http://127.0.0.1 : fonctionne. Sur l'IP réseau (http://192.168.x.x, le cas
// réel d'une table en présentiel sans certificat), le navigateur refuse la
// caméra — ce n'est pas un bug de ce composant, c'est la plateforme. L'écran
// AFFICHE ce refus avec sa raison plutôt que de laisser un cadre mort, et la
// saisie manuelle du code reste pleinement fonctionnelle dans tous les cas
// (ECR-05 le prévoyait déjà).

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { lireEntree } from '../routeur/index.ts';
import { texte } from '../logique/contenu.ts';

const emettre = defineEmits<{ codeDetecte: [code: string] }>();

/** Déclaration minimale : absente de lib.dom.d.ts au moment de l'écriture. */
interface DetecteurCodeBarres {
  detect(source: HTMLVideoElement): Promise<readonly { readonly rawValue: string }[]>;
}
interface FabriqueDetecteurCodeBarres {
  new (options: { formats: readonly string[] }): DetecteurCodeBarres;
}

const INTERVALLE_BALAYAGE_MS = 350;

const video = ref<HTMLVideoElement | null>(null);
const flux = ref<MediaStream | null>(null);
const disponible = ref(true);
const raisonIndisponible = ref('');
let minuterie: ReturnType<typeof setInterval> | null = null;

function arreterFlux(): void {
  if (minuterie !== null) clearInterval(minuterie);
  minuterie = null;
  flux.value?.getTracks().forEach((piste) => piste.stop());
  flux.value = null;
}

/** Un QR qui n'encode pas une URL /adhesion/:code reconnue est ignoré. */
function extraireCode(valeurBrute: string): string | null {
  try {
    const entree = lireEntree(new URL(valeurBrute).pathname);
    return entree.intention === 'adhesion' ? entree.code : null;
  } catch {
    return null;
  }
}

async function balayer(detecteur: DetecteurCodeBarres): Promise<void> {
  if (video.value === null) return;
  try {
    const resultats = await detecteur.detect(video.value);
    for (const resultat of resultats) {
      const code = extraireCode(resultat.rawValue);
      if (code !== null) {
        arreterFlux();
        emettre('codeDetecte', code);
        return;
      }
    }
  } catch {
    // Une image illisible (flou, mouvement) n'est pas une erreur : le
    // prochain passage du minuteur réessaie sur l'image suivante.
  }
}

onMounted(async () => {
  const fabrique = (globalThis as { BarcodeDetector?: FabriqueDetecteurCodeBarres }).BarcodeDetector;
  if (!globalThis.isSecureContext) {
    disponible.value = false;
    raisonIndisponible.value = texte('ecran.rejoindre.scan_contexte_non_securise');
    return;
  }
  if (fabrique === undefined) {
    disponible.value = false;
    raisonIndisponible.value = texte('ecran.rejoindre.scan_non_pris_en_charge');
    return;
  }

  try {
    flux.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
  } catch {
    disponible.value = false;
    raisonIndisponible.value = texte('ecran.rejoindre.scan_camera_refusee');
    return;
  }

  if (video.value !== null) video.value.srcObject = flux.value;
  const detecteur = new fabrique({ formats: ['qr_code'] });
  minuterie = setInterval(() => void balayer(detecteur), INTERVALLE_BALAYAGE_MS);
});

onBeforeUnmount(arreterFlux);
</script>

<template>
  <div
    v-if="disponible"
    class="scanner"
  >
    <video
      ref="video"
      class="scanner__video"
      autoplay
      playsinline
      muted
    />
    <div
      class="scanner__cadre"
      aria-hidden="true"
    >
      <span class="scanner__coin scanner__coin--haut-gauche" />
      <span class="scanner__coin scanner__coin--haut-droite" />
      <span class="scanner__coin scanner__coin--bas-gauche" />
      <span class="scanner__coin scanner__coin--bas-droite" />
    </div>
    <p class="scanner__invite">
      {{ texte('ecran.rejoindre.scan_invite') }}
    </p>
  </div>

  <p
    v-else
    class="scanner__indisponible"
  >
    {{ raisonIndisponible }}
  </p>
</template>

<style scoped>
.scanner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
}

.scanner__video {
  inline-size: 100%;
  aspect-ratio: 1;
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
  object-fit: cover;
}

/* Cadre de visée superposé à la vidéo : quatre coins, comme le prototype. */
.scanner__cadre {
  position: absolute;
  inset-block-start: var(--gdv-espacement-16);
  inset-inline: var(--gdv-espacement-16);
  aspect-ratio: 1;
  pointer-events: none;
}

.scanner__coin {
  position: absolute;
  inline-size: var(--gdv-espacement-32);
  block-size: var(--gdv-espacement-32);
  border-color: var(--gdv-accent-action);
  border-style: solid;
}

.scanner__coin--haut-gauche {
  inset-block-start: 0;
  inset-inline-start: 0;
  border-width: var(--gdv-trait-epais) 0 0 var(--gdv-trait-epais);
}

.scanner__coin--haut-droite {
  inset-block-start: 0;
  inset-inline-end: 0;
  border-width: var(--gdv-trait-epais) var(--gdv-trait-epais) 0 0;
}

.scanner__coin--bas-gauche {
  inset-block-end: 0;
  inset-inline-start: 0;
  border-width: 0 0 var(--gdv-trait-epais) var(--gdv-trait-epais);
}

.scanner__coin--bas-droite {
  inset-block-end: 0;
  inset-inline-end: 0;
  border-width: 0 var(--gdv-trait-epais) var(--gdv-trait-epais) 0;
}

.scanner__invite {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  text-align: center;
}

.scanner__indisponible {
  margin: 0;
  padding: var(--gdv-espacement-12);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}
</style>
