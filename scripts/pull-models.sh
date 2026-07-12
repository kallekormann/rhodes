#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "Pulling Ollama models via $OLLAMA_HOST ..."

pull_model() {
  local name="$1"
  echo "→ $name"
  curl -sf "$OLLAMA_HOST/api/pull" -d "{\"name\":\"$name\"}" || {
    echo "Failed to pull $name"
    exit 1
  }
  echo ""
}

pull_model "nomic-embed-text"
pull_model "llama3.2:3b-instruct-q4_K_M"

if [[ "${PULL_CHAT_MODEL:-0}" == "1" ]]; then
  pull_model "llama3.1:8b-instruct-q4_K_M"
else
  echo "Skipping llama3.1:8b (set PULL_CHAT_MODEL=1 to pull). Ask falls back to llama3.2:3b."
fi

echo "Models pulled successfully."
