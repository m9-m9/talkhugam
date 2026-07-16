#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly FUNCTIONS_DIR="$ROOT_DIR/supabase/functions"
readonly MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
readonly CONFIG_FILE="$ROOT_DIR/supabase/config.toml"

fail() {
  printf 'security check failed: %s\n' "$1" >&2
  exit 1
}

check_tracked_env_files() {
  local tracked_env_files
  tracked_env_files="$(
    git -C "$ROOT_DIR" ls-files \
      | awk '/(^|\/)\.env($|\.)/ && $0 !~ /\.env\.example$/ { print }'
  )"

  [[ -z "$tracked_env_files" ]] \
    || fail "tracked runtime environment file(s): $tracked_env_files"
}

check_cors_policy() {
  if find "$FUNCTIONS_DIR" -type f -name '*.ts' -exec grep -E -n -i \
    "access-control-allow-origin['\"]?[[:space:]]*[:=][[:space:]]*['\"]\\*|cors_origin[[:space:]]*:[[:space:]]*['\"]\\*" \
    {} +; then
    fail 'wildcard CORS origin found'
  fi

  grep -E -q "readOptionalEnv\('ALLOWED_ORIGINS'\)" "$FUNCTIONS_DIR/_shared/cors.ts" \
    || fail 'CORS helper must read ALLOWED_ORIGINS'
}

check_logging_policy() {
  local direct_console_calls
  direct_console_calls="$(
    find "$FUNCTIONS_DIR" -type f -name '*.ts' \
      ! -path "$FUNCTIONS_DIR/_shared/logger.ts" \
      ! -name '*test.ts' \
      -exec grep -E -n 'console\.(debug|error|info|log|warn)' {} + || true
  )"

  [[ -z "$direct_console_calls" ]] \
    || fail "direct console logging outside logger: $direct_console_calls"

  if grep -E -n "^[[:space:]]*'(body|caption|email|token|uploadUrl|userId)'," \
    "$FUNCTIONS_DIR/_shared/logger.ts"; then
    fail 'sensitive field found in operational log allowlist'
  fi
}

check_function_auth_registration() {
  local function_dir function_name

  for function_dir in "$FUNCTIONS_DIR"/*; do
    [[ -d "$function_dir" ]] || continue
    function_name="$(basename "$function_dir")"
    [[ "$function_name" == _* ]] && continue

    grep -E -q "^\[functions\.${function_name}\]$" "$CONFIG_FILE" \
      || fail "missing config.toml entry for Edge Function: $function_name"
    awk -v section="[functions.${function_name}]" '
      $0 == section { found = 1; next }
      found && /^\[/ { exit }
      found && /^verify_jwt = false$/ { verified = 1 }
      END { exit !verified }
    ' "$CONFIG_FILE" \
      || fail "Edge Function must use explicit in-function auth: $function_name"
  done
}

extract_created_objects() {
  sed -En \
    -e 's/^[[:space:]]*create[[:space:]]+(table|type)[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?([^[:space:](;]+).*/\1 \3/ip' \
    -e 's/^[[:space:]]*create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?trigger[[:space:]]+([^[:space:]]+).*/trigger \2/ip' \
    "$MIGRATIONS_DIR"/*.sql \
    | tr '[:upper:]' '[:lower:]'
}

check_duplicate_migration_objects() {
  local duplicates
  duplicates="$(extract_created_objects | sort | uniq -d)"

  [[ -z "$duplicates" ]] \
    || fail "duplicate table/type/trigger definitions: $duplicates"
}

check_tracked_env_files
check_cors_policy
check_logging_policy
check_function_auth_registration
check_duplicate_migration_objects

printf 'backend security checks passed\n'
