#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly PACKAGE_FILE="$ROOT_DIR/package.json"
readonly RUNNER_FILE="$ROOT_DIR/scripts/run-integration-tests.sh"

readonly INTEGRATION_COMMAND="$(node -e "const pkg = require(process.argv[1]); process.stdout.write(pkg.scripts['backend:test:integration'] ?? '')" "$PACKAGE_FILE")"

if [[ -z "$INTEGRATION_COMMAND" ]]; then
  printf 'integration test command check failed: backend:test:integration is missing\n' >&2
  exit 1
fi

if [[ "$INTEGRATION_COMMAND" != "bash scripts/run-integration-tests.sh" ]]; then
  printf 'integration test command check failed: the environment-aware runner is required\n' >&2
  exit 1
fi

if [[ ! -f "$RUNNER_FILE" ]]; then
  printf 'integration test command check failed: runner file is missing\n' >&2
  exit 1
fi

grep -Fq 'if [[ -f "$ROOT_DIR/.env" ]]' "$RUNNER_FILE" \
  || { printf 'integration test command check failed: local .env detection is required\n' >&2; exit 1; }

grep -Fq -- '--env-file=.env' "$RUNNER_FILE" \
  || { printf 'integration test command check failed: local .env loading is required\n' >&2; exit 1; }

printf 'integration test command checks passed\n'
