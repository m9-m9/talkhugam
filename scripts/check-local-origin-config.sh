#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly ENV_EXAMPLE="$ROOT_DIR/.env.example"

if grep -Eq 'localhost:3000|127\.0\.0\.1:3000' "$ENV_EXAMPLE"; then
  printf 'local origin check failed: .env.example must use Vite port 5173\n' >&2
  exit 1
fi

grep -Fq 'ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173' "$ENV_EXAMPLE" \
  || {
    printf 'local origin check failed: ALLOWED_ORIGINS must include both local 5173 origins\n' >&2
    exit 1
  }

grep -Fq 'ALLOWED_AUTH_REDIRECTS=http://localhost:5173/auth/callback,http://127.0.0.1:5173/auth/callback' "$ENV_EXAMPLE" \
  || {
    printf 'local origin check failed: ALLOWED_AUTH_REDIRECTS must include both local 5173 callbacks\n' >&2
    exit 1
  }

grep -Fq 'TEST_ORIGIN=http://localhost:5173' "$ENV_EXAMPLE" \
  || {
    printf 'local origin check failed: TEST_ORIGIN must use localhost:5173\n' >&2
    exit 1
  }

printf 'local origin configuration checks passed\n'
