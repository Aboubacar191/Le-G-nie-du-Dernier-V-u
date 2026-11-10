# Déploiement — provisoire, hors nœud S7

Ces fichiers déploient le squelette sur un VPS pour un accès rapide
(playtest / démonstration). **Ce n'est pas la décision du nœud S7**
(ARCHI-GDV-001 : `stack.hebergement` = « hors périmètre ») : aucun ADR
n'a été produit, aucune porte qualité n'a été ajoutée pour ce choix.

## Stratégie TLS retenue pour ce déploiement

`standards.transport_chiffre` exige https/wss « en toute circonstance ».
Sur ce VPS, le TLS est terminé par le reverse proxy partagé (1Panel/
OpenResty), pas par le serveur Node lui-même :

```
Téléphone joueur → HTTPS/WSS → 1Panel (TLS) → HTTP/WS en clair (loopback) → gdv-client (nginx) → gdv-serveur
```

Le serveur tourne donc en `MODE=developpement` (pas de `CHEMIN_CERT`/
`CHEMIN_CLE`) : le garde-fou `exigerTls` de `configuration/index.ts` ne
s'applique qu'en `MODE=production`. La menace décrite dans l'ARCHI (écoute
passive d'un jeton sur un Wi-Fi partagé par les joueurs) ne s'applique pas
ici : les téléphones parlent à 1Panel via l'Internet public, chiffré de
bout en bout jusqu'au VPS ; le trafic en clair ne quitte jamais la boucle
locale du serveur. Si ce projet est un jour joué en LAN pur (sans VPS),
cette stratégie ne convient plus et le nœud S7 doit trancher pour de bon.

## Déployer

Depuis la racine du dépôt, sur le VPS :

```bash
cd deploiement
docker compose up -d --build
```

Le sous-domaine `legenie.aboubacar-kone.space` est configuré côté 1Panel
en proxy inverse vers `127.0.0.1:8096` (conteneur `gdv-client`).

La base SQLite vit dans le volume nommé `gdv_donnees`, indépendant des
conteneurs : elle survit à un `docker compose up --build`.

## CI/CD

`.github/workflows/deploy.yml` : à chaque push sur `main`,

1. `npm run verifier` — **toutes** les portes qualité du projet (secrets,
   visibilité, types, lint, couches, tests, couverture, audit, uniformité,
   routes). Le déploiement ne se lance QUE si cette porte est verte.
2. Si vert : archive le code (hors `node_modules`/`dist`/`donnees`),
   l'envoie via une clé SSH dédiée et restreinte (`command=` forcé sur
   `receive-deploy.sh`, aucun shell libre) vers le VPS, qui reconstruit et
   relance `gdv-serveur` + `gdv-client`.
3. Vérifie que `https://legenie.aboubacar-kone.space/` répond.

**État réel au 2026-11-10** : la porte `verifier:uniformite` échoue (20
divergences — tailles de trames inégales malgré le remplissage, et surtout
des actes secrets qui changent le NOMBRE de trames reçues par les joueurs
non impliqués, ce qui est un canal auxiliaire observable). Le pipeline est
donc rouge tant que ce point n'est pas corrigé : c'est voulu, pas un défaut
d'outillage — voir le nœud qui traite le remplissage/l'uniformité des
trames.

Secrets GitHub requis sur ce dépôt (Settings → Secrets and variables →
Actions) : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (clé privée
dédiée, différente de celle du portfolio).
