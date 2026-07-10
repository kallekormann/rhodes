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

echo "Models pulled successfully."
