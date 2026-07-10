#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

SERVICE="${1:-}"

if [[ -n "$SERVICE" ]]; then
  docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "$SERVICE"
else
  docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
fi
