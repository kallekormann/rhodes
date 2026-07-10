#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created docker/.env from .env.example"
fi

sh utils/generate-keys.sh "$@"

# Mirror Supabase keys into Rhodes app env vars when present.
if grep -q '^ANON_KEY=' .env && grep -q '^SERVICE_ROLE_KEY=' .env; then
  anon="$(grep '^ANON_KEY=' .env | cut -d= -f2-)"
  service="$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)"
  for var in SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY; do
    if grep -q "^${var}=" .env; then
      sed -i.bak "s|^${var}=.*|${var}=${anon}|" .env
    else
      echo "${var}=${anon}" >> .env
    fi
  done
  if grep -q '^SUPABASE_SERVICE_ROLE_KEY=' .env; then
    sed -i.bak "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${service}|" .env
  else
    echo "SUPABASE_SERVICE_ROLE_KEY=${service}" >> .env
  fi
  rm -f .env.bak
fi

echo "Keys written to docker/.env"
