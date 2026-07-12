#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy docker/.env.example and run ./scripts/generate-keys.sh"
  exit 1
fi

load_env_file() {
  while IFS= read -r line || [[ -n "$line" ]]; do
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"

    [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
    [[ "$trimmed" != *=* ]] && continue

    local key="${trimmed%%=*}"
    local value="${trimmed#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"

    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$ENV_FILE"
}

load_env_file

read_env() {
  grep -E "^${1}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
}

# Worker runs on the host — remap Docker-internal hostnames to localhost.
export SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(read_env SUPABASE_SERVICE_ROLE_KEY)}"
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  export SUPABASE_SERVICE_ROLE_KEY="$(read_env SERVICE_ROLE_KEY)"
fi
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
if [[ "${REDIS_URL}" == redis://redis:* ]]; then
  export REDIS_URL="redis://localhost:6379"
fi
export TIKA_URL="${TIKA_URL:-http://localhost:9998}"

if [[ "${TIKA_URL:-}" == *"://tika:"* ]]; then
  export TIKA_URL="http://localhost:9998"
fi

if [[ "${OLLAMA_HOST:-}" == *"://ollama:"* ]]; then
  export OLLAMA_HOST="http://localhost:11434"
fi

export RHODES_DATA_DIR="$ROOT/.data"
export RHODES_LIBRARY_DATA_DIR="$ROOT/.data/library-files"
export RHODES_DOCUMENT_IMAGES_DATA_DIR="$ROOT/.data/document-images"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY in docker/.env"
  exit 1
fi

echo "Worker env: SUPABASE_URL=$SUPABASE_URL REDIS_URL=$REDIS_URL OLLAMA_HOST=${OLLAMA_HOST:-http://localhost:11434}"

cd "$ROOT"
exec pnpm --filter @rhodes/worker dev
