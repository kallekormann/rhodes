#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"

read_env() {
  local key="$1"
  local default="${2:-}"
  if [[ -f "$ENV_FILE" ]]; then
    local line
    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      printf '%s' "${line#*=}"
      return
    fi
  fi
  printf '%s' "$default"
}

SUPABASE_URL="$(read_env SUPABASE_URL http://localhost:8000)"
ANON_KEY="$(read_env ANON_KEY)"
if [[ -z "$ANON_KEY" ]]; then
  ANON_KEY="$(read_env SUPABASE_ANON_KEY)"
fi
OLLAMA_HOST="$(read_env OLLAMA_HOST http://localhost:11434)"
# Host-side health checks cannot reach the in-compose hostname `ollama`.
if [[ "$OLLAMA_HOST" == *"ollama:"* ]]; then
  OLLAMA_HOST="http://localhost:11434"
fi
MAX_WAIT="${HEALTH_CHECK_TIMEOUT:-180}"

echo "Waiting for services (timeout ${MAX_WAIT}s)..."

wait_for() {
  local name="$1"
  local cmd="$2"
  local elapsed=0
  until eval "$cmd" >/dev/null 2>&1; do
    if (( elapsed >= MAX_WAIT )); then
      echo "✗ $name did not become healthy in ${MAX_WAIT}s"
      exit 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  echo "✓ $name"
}

if [[ -z "$ANON_KEY" ]]; then
  echo "Warning: ANON_KEY not set; skipping Supabase REST check"
else
  wait_for "Supabase REST" "code=\$(curl -s -o /dev/null -w '%{http_code}' -H 'apikey: ${ANON_KEY}' -H 'Authorization: Bearer ${ANON_KEY}' '${SUPABASE_URL}/rest/v1/'); [[ \"\$code\" == 200 || \"\$code\" == 401 || \"\$code\" == 403 ]]"
fi

if [[ -z "$ANON_KEY" ]]; then
  wait_for "Kong / Auth" "curl -sf '${SUPABASE_URL}/auth/v1/health' || curl -s -o /dev/null -w '%{http_code}' '${SUPABASE_URL}/auth/v1/health' | grep -qE '200|401'"
else
  wait_for "Kong / Auth" "curl -sf '${SUPABASE_URL}/auth/v1/health' -H 'apikey: ${ANON_KEY}'"
fi
wait_for "Redis" "docker exec rhodes-redis redis-cli ping | grep -q PONG"
wait_for "Ollama" "curl -sf '${OLLAMA_HOST}/api/tags'"
wait_for "Tika" "docker exec rhodes-tika wget -q --spider http://localhost:9998/tika"

echo ""
echo "All health checks passed."
