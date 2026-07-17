#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly WORKFLOW_FILE="$ROOT_DIR/.github/workflows/integration-tests.yml"

if [[ ! -f "$WORKFLOW_FILE" ]]; then
  printf 'integration workflow check failed: workflow file is missing\n' >&2
  exit 1
fi

grep -Fq 'workflow_dispatch:' "$WORKFLOW_FILE" \
  || { printf 'integration workflow check failed: manual trigger is required\n' >&2; exit 1; }

grep -Fq 'environment: integration' "$WORKFLOW_FILE" \
  || { printf 'integration workflow check failed: isolated environment is required\n' >&2; exit 1; }

grep -Fq 'RUN_INTEGRATION_TESTS: true' "$WORKFLOW_FILE" \
  || { printf 'integration workflow check failed: integration tests must be enabled\n' >&2; exit 1; }

grep -Fq 'pnpm backend:test:integration' "$WORKFLOW_FILE" \
  || { printf 'integration workflow check failed: integration test command is required\n' >&2; exit 1; }

if grep -Fq 'backend:test:mux' "$WORKFLOW_FILE"; then
  printf 'integration workflow check failed: Mux live test must remain manual\n' >&2
  exit 1
fi

printf 'integration workflow checks passed\n'
