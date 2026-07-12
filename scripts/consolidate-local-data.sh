#!/usr/bin/env bash
# Merge legacy apps/web/.data into monorepo-root .data (one-time / safe to re-run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEGACY="$ROOT/apps/web/.data"
TARGET="$ROOT/.data"

if [[ ! -d "$LEGACY" ]]; then
  echo "No legacy data at $LEGACY — nothing to merge."
  exit 0
fi

mkdir -p "$TARGET"

for sub in library-files document-images; do
  if [[ -d "$LEGACY/$sub" ]]; then
    mkdir -p "$TARGET/$sub"
    # -n: do not overwrite files already at the canonical location.
    cp -Rn "$LEGACY/$sub/." "$TARGET/$sub/" 2>/dev/null || true
    echo "Merged $LEGACY/$sub → $TARGET/$sub"
  fi
done

echo ""
echo "Canonical dev data directory: $TARGET"
echo "Re-run ./scripts/sync-web-env.sh and restart the web app if it is running."
