#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(git rev-parse --show-toplevel)"

cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  exec deno test --config supabase/functions/deno.json --allow-env --allow-net --env-file=.env supabase/tests/integration
fi

exec deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/tests/integration
