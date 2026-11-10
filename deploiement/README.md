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
