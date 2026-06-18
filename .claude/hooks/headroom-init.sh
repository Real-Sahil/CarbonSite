#!/bin/bash
set -uo pipefail

# Only run in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v headroom >/dev/null 2>&1; then
  pip install --quiet headroom-ai || exit 0
fi

headroom init hook ensure || true
