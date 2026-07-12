#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docker/.env"
DEST="$ROOT/apps/web/.env.local"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC — run ./scripts/generate-keys.sh first"
  exit 1
fi

read_env() {
  grep -E "^${1}=" "$SRC" | tail -1 | cut -d= -f2- || true
}

anon="$(read_env ANON_KEY)"
if [[ -z "$anon" ]]; then
  anon="$(read_env SUPABASE_ANON_KEY)"
fi

service_role="$(read_env SUPABASE_SERVICE_ROLE_KEY)"
if [[ -z "$service_role" ]]; then
  service_role="$(read_env SERVICE_ROLE_KEY)"
fi

cat > "$DEST" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service_role}
REDIS_URL=redis://localhost:6379
RHODES_LIBRARY_DATA_DIR=${ROOT}/.data/library-files
EOF

echo "Wrote $DEST"
