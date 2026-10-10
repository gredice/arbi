#!/usr/bin/env bash
# Claude Code SessionStart hook: prepare the workspace in cloud sessions.
# Local sessions exit immediately. Expects scripts/cloud/setup.sh to have run.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Put the pinned Node first for this hook and for Claude's later commands,
# whatever PATH order the base image uses. Match CI's telemetry and offline
# site-data settings.
env_lines=(
    'export PATH="/opt/node24/bin:$PATH"'
    'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0'
    'export TURBO_TELEMETRY_DISABLED=1'
    'export NEXT_TELEMETRY_DISABLED=1'
    'export ARBI_OFFLINE=1'
)
for line in "${env_lines[@]}"; do
    eval "$line"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then printf '%s\n' "$line" >>"$CLAUDE_ENV_FILE"; fi
done

expected="$(cat .nvmrc)"
actual="$(node --version 2>/dev/null || true)"
if [ "$actual" != "$expected" ]; then
    echo "Expected Node $expected from .nvmrc but found '${actual:-none}'." >&2
    echo "Update scripts/cloud/setup.sh, then change the environment's setup script to rebuild its cache." >&2
    exit 1
fi

pnpm install --frozen-lockfile
