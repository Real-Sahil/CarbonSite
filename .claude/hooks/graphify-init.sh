#!/bin/bash
# Keeps the graphify knowledge graph (graphify-out/, not committed) current.
# Cloud sessions install or upgrade the graphifyy CLI; every session installs
# graphify's git hooks (rebuild after each commit and checkout) and rebuilds
# the graph in the background. AST only, no API calls. Never blocks a session.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
export PATH="$HOME/.local/bin:$PATH"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v uv >/dev/null 2>&1; then
    pip install --quiet uv >/dev/null 2>&1 || exit 0
  fi
  if command -v graphify >/dev/null 2>&1; then
    uv tool upgrade --quiet graphifyy >/dev/null 2>&1 || true
  else
    uv tool install --quiet --with mcp graphifyy >/dev/null 2>&1 || exit 0
  fi
fi

command -v graphify >/dev/null 2>&1 || exit 0

graphify hook install >/dev/null 2>&1 || true
nohup graphify update . >/dev/null 2>&1 &
exit 0
