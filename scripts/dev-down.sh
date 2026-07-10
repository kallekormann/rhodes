#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

PRUNE=false
if [[ "${1:-}" == "--prune" ]]; then
  PRUNE=true
fi

docker compose -f docker-compose.yml -f docker-compose.dev.yml down

if [[ "$PRUNE" == "true" ]]; then
  echo "Removing named volumes (database and model cache will be lost)..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
fi

echo "Dev stack stopped."
