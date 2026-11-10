#!/bin/bash
# Script forcé côté VPS pour la clé de déploiement CI/CD (command= dans
# authorized_keys). Reçoit une archive tar.gz sur stdin, la valide AVANT
# de toucher au service en place, puis reconstruit et relance les
# conteneurs. Une archive vide ou invalide n'efface rien (incident vécu
# sur le portfolio, corrigé ici dès la première version).
set -euo pipefail
TARGET="/home/abou/gdv-deploy"
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

cat > "$STAGING/source.tar.gz"

if ! tar -tzf "$STAGING/source.tar.gz" >/dev/null 2>&1; then
  echo "Archive invalide ou vide : deploiement annule, service inchange" >&2
  exit 1
fi

mkdir -p "$STAGING/extrait"
tar -xzf "$STAGING/source.tar.gz" -C "$STAGING/extrait"

if [ ! -f "$STAGING/extrait/deploiement/docker-compose.yml" ]; then
  echo "docker-compose.yml absent de l archive : deploiement annule, service inchange" >&2
  exit 1
fi

find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -r "$STAGING/extrait/." "$TARGET/"

cd "$TARGET/deploiement"
docker compose build
docker compose up -d
echo "Deploiement termine : $(date)"
