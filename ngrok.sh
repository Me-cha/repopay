#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing %s. Copy .env.example to .env and configure Repopay first.\n' "$ENV_FILE" >&2
  exit 1
fi

read_env() {
  local key="$1" value
  value="$(awk -v key="$key" 'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' "$ENV_FILE")"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" ]]; then value="${value:1:${#value}-2}"; fi
  if [[ "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
  printf '%s' "$value"
}

DOMAIN="${NGROK_DOMAIN:-$(read_env NGROK_DOMAIN)}"
PORT_VALUE="${PORT:-$(read_env PORT)}"
PUBLIC_ORIGIN="${PUBLIC_URL:-$(read_env PUBLIC_URL)}"
PORT_VALUE="${PORT_VALUE:-3000}"

if [[ -z "$DOMAIN" ]]; then
  printf 'Set NGROK_DOMAIN in .env to the stable domain assigned to your ngrok account.\n' >&2
  printf 'Find it in the ngrok dashboard under Gateway > Domains.\n' >&2
  exit 1
fi

if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ || "$DOMAIN" == *..* ]]; then
  printf 'NGROK_DOMAIN must be a hostname only (no scheme, path, or trailing dot).\n' >&2
  exit 1
fi

if [[ ! "$PORT_VALUE" =~ ^[0-9]+$ ]] || (( PORT_VALUE < 1 || PORT_VALUE > 65535 )); then
  printf 'PORT must be an integer between 1 and 65535.\n' >&2
  exit 1
fi

EXPECTED_ORIGIN="https://$DOMAIN"
if [[ "$PUBLIC_ORIGIN" != "$EXPECTED_ORIGIN" ]]; then
  printf 'Set PUBLIC_URL=%s in .env, then restart Repopay before starting the tunnel.\n' "$EXPECTED_ORIGIN" >&2
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  printf 'ngrok is not installed. Install the official ngrok agent first.\n' >&2
  exit 1
fi

if ! ngrok config check >/dev/null 2>&1; then
  printf 'ngrok is not authenticated. Run: ngrok config add-authtoken <your-token>\n' >&2
  printf 'Keep the token in ngrok config; do not put it in Repopay .env.\n' >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1 || ! curl --silent --show-error --fail --max-time 3 "http://127.0.0.1:$PORT_VALUE/healthz" >/dev/null; then
  printf 'Repopay is not healthy on port %s. Start it with pnpm dev first.\n' "$PORT_VALUE" >&2
  exit 1
fi

exec ngrok http "http://127.0.0.1:$PORT_VALUE" --url "$EXPECTED_ORIGIN" --inspect=false
