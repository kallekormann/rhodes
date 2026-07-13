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

smtp_host="$(read_env SMTP_HOST)"
if [[ -z "$smtp_host" || "$smtp_host" == "mailpit" ]]; then
  smtp_host="127.0.0.1"
fi

smtp_port="$(read_env SMTP_PORT)"
if [[ -z "$smtp_port" || "$smtp_port" == "1025" ]]; then
  # docker-compose.dev.yml maps Mailpit SMTP to host 1026 (MailHog often owns 127.0.0.1:1025).
  smtp_port="1026"
fi

smtp_from="$(read_env SMTP_FROM)"
if [[ -z "$smtp_from" ]]; then
  smtp_from="$(read_env SMTP_ADMIN_EMAIL)"
fi
if [[ -z "$smtp_from" ]]; then
  smtp_from="dev@rhodes.local"
fi

smtp_sender_name="$(read_env SMTP_SENDER_NAME)"
if [[ -z "$smtp_sender_name" ]]; then
  smtp_sender_name="Rhodes"
fi

cat > "$DEST" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service_role}
REDIS_URL=redis://localhost:6379
RHODES_DATA_DIR=${ROOT}/.data
RHODES_LIBRARY_DATA_DIR=${ROOT}/.data/library-files
RHODES_DOCUMENT_IMAGES_DATA_DIR=${ROOT}/.data/document-images

# Team invite emails (Mailpit UI: http://localhost:8025)
SMTP_HOST=${smtp_host}
SMTP_PORT=${smtp_port}
SMTP_FROM=${smtp_from}
SMTP_SENDER_NAME=${smtp_sender_name}
EOF

echo "Wrote $DEST"
