#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

if [[ ! -f .env ]]; then
  echo "No docker/.env found. Copying from .env.example..."
  cp .env.example .env
  echo "Run: cd docker && sh utils/generate-keys.sh --update-env"
  echo "Then re-run ./scripts/dev-up.sh"
  exit 1
fi

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
"$ROOT/scripts/health-check.sh"
echo ""
echo "Dev stack running."
echo "  Supabase API:  http://localhost:8000"
echo "  Studio:        http://localhost:54323"
echo "  Mailpit:       http://localhost:8025"
echo "  Ollama:        http://localhost:11434"
echo "  Tika:          http://localhost:9998"
