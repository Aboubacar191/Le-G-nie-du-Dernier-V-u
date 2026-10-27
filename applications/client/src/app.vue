<script setup lang="ts">
// AMORCE — nœud S5 (dev-frontend) : écrans, routeur monté, transport branché.
// Aucun composant d'interface, aucun écran, aucun thème n'est choisi ici.
import { ROUTES } from './routeur/index.ts';

const routes = ROUTES;
</script>

<template>
  <main class="coquille">
    <h1>Le Génie du Dernier Vœu</h1>
    <p>
      Squelette de la PWA. Les écrans sont livrés par le nœud S5 ; la référence visuelle
      est dans <code>.claude/orchestration/reference-prototype/</code>.
    </p>
    <ul>
      <li
        v-for="route in routes"
        :key="route.nom"
      >
        <code>{{ route.chemin }}</code> — {{ route.nom }}
      </li>
    </ul>
  </main>
</template>

<style scoped>
.coquille {
  font-family: var(--gdv-police-texte);
  color: var(--gdv-texte-primaire);
  background: var(--gdv-surface-fond);
  padding: var(--gdv-espace-4);
  min-height: 100vh;
}

code {
  font-family: var(--gdv-police-chiffres);
}
</style>
