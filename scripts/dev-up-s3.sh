#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

if [[ ! -f .env ]]; then
  echo "No docker/.env found. Copying from .env.example..."
  cp .env.example .env
  echo "Run: cd docker && sh utils/generate-keys.sh --update-env"
  echo "Then re-run ./scripts/dev-up-s3.sh"
  exit 1
fi

COMPOSE_FILES=(
  -f docker-compose.yml
  -f docker-compose.dev.yml
  -f docker-compose.s3.yml
)

docker compose "${COMPOSE_FILES[@]}" up -d
"$ROOT/scripts/health-check.sh"
echo ""
echo "Dev stack running (Supabase Storage → S3/MinIO backend)."
echo "  Supabase API:  http://localhost:8000"
echo "  Studio:        http://localhost:54323"
echo "  Mailpit:       http://localhost:8025"
echo ""
echo "Blob backend: MinIO (rehearses VPS Hetzner/R2 cutover)."
echo "App uploads still go through Supabase Storage buckets — no app code changes."
echo ""
echo "Default file-backed storage: ./scripts/dev-up.sh"
