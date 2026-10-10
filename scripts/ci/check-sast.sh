#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
mkdir -p .ci/reports
export SEMGREP_SEND_METRICS=off
export SEMGREP_ENABLE_VERSION_CHECK=0

# The pinned CE container provides this CLI. Never download remote rule packs.
semgrep scan --test --config .semgrep/rules .semgrep/tests \
  --oss-only --metrics off --disable-version-check --strict

semgrep scan --config .semgrep/rules \
  --oss-only --metrics off --disable-version-check --strict --error \
  --exclude '.semgrep/tests' --exclude 'node_modules' --exclude '.next' \
  --exclude 'dist' --exclude 'backend/dist' --exclude 'reports' \
  --json --output .ci/reports/semgrep.json --sarif-output .ci/reports/semgrep.sarif \
  app src backend/src backend/test scripts *.mjs vite.config.ts
