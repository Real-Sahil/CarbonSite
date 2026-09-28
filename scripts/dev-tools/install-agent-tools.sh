#!/usr/bin/env bash
# Installs and enables the owner's agent tooling for every Claude Code project
# on this machine (user scope, ~/.claude), not just this repo:
#   - ponytail  (Claude Code plugin, marketplace DietrichGebert/ponytail)
#   - graphify  (knowledge graph CLI + MCP server; rebuilds the graph of any git
#                repo at session start and after each commit)
# Self-contained and idempotent: safe to run again, and safe to paste into a
# Claude Code cloud environment's setup script so every new session gets it.
# Headroom is deliberately not configured here: it reroutes all model traffic
# through a local proxy (ANTHROPIC_BASE_URL), which is an opt-in per machine.
set -uo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
export PATH="$HOME/.local/bin:$PATH"
log() { printf '[agent-tools] %s\n' "$*"; }

# ── graphify CLI (Python, via uv) ─────────────────────────────────────────────
if ! command -v uv >/dev/null 2>&1; then
  log "installing uv"
  if command -v pip >/dev/null 2>&1; then pip install --quiet --user uv || pip install --quiet uv; fi
  command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
fi
if command -v uv >/dev/null 2>&1; then
  if command -v graphify >/dev/null 2>&1; then
    uv tool upgrade --quiet graphifyy >/dev/null 2>&1 || true
  else
    uv tool install --quiet --with mcp graphifyy >/dev/null 2>&1 || log "graphify install failed"
  fi
fi
command -v graphify >/dev/null 2>&1 && log "graphify $(graphify --version 2>/dev/null | awk '{print $2}')" || log "graphify not available"
command -v node >/dev/null 2>&1 || log "warning: node not on PATH; ponytail's always-on hooks stay quiet until it is"

# ── Global graphify session hook ──────────────────────────────────────────────
mkdir -p "$CLAUDE_DIR/hooks"
cat > "$CLAUDE_DIR/hooks/graphify-session.sh" <<'HOOK'
#!/usr/bin/env bash
# Any git repo: install graphify's git hooks (rebuild after commit/checkout)
# and rebuild graphify-out/ in the background. Skips repos that ship their own
# graphify hook. AST only, no API calls, never blocks the session.
export PATH="$HOME/.local/bin:$PATH"
dir="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$dir" 2>/dev/null || exit 0
command -v graphify >/dev/null 2>&1 || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -x .claude/hooks/graphify-init.sh ] && exit 0
# Keep the generated graph out of commits in repos that have not decided otherwise.
if ! git check-ignore -q graphify-out/ 2>/dev/null && [ -z "$(git ls-files graphify-out 2>/dev/null | head -1)" ]; then
  mkdir -p "$(git rev-parse --git-dir)/info" && echo "graphify-out/" >> "$(git rev-parse --git-dir)/info/exclude"
fi
graphify hook install >/dev/null 2>&1 || true
# The merge driver line lands in an untracked .gitattributes; keep it local instead.
if [ -f .gitattributes ] && ! git ls-files --error-unmatch .gitattributes >/dev/null 2>&1 \
   && [ "$(grep -cv 'merge=graphify' .gitattributes)" = "0" ]; then
  cat .gitattributes >> "$(git rev-parse --git-dir)/info/attributes" && rm -f .gitattributes
fi
nohup graphify update . >/dev/null 2>&1 &
exit 0
HOOK
chmod +x "$CLAUDE_DIR/hooks/graphify-session.sh"

# ── ~/.claude/settings.json: ponytail plugin + graphify hooks ─────────────────
python3 - "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/hooks/graphify-session.sh" <<'PY'
import json, os, sys
path, session_hook = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        s = json.load(f)
except FileNotFoundError:
    s = {}

s.setdefault("extraKnownMarketplaces", {})["ponytail"] = {"source": {"source": "github", "repo": "DietrichGebert/ponytail"}}
s.setdefault("enabledPlugins", {})["ponytail@ponytail"] = True

hooks = s.setdefault("hooks", {})
def add(event, matcher, command, timeout):
    blocks = hooks.setdefault(event, [])
    if any(h.get("command") == command for b in blocks for h in b.get("hooks", [])):
        return
    block = {"hooks": [{"type": "command", "command": command, "timeout": timeout}]}
    if matcher:
        block["matcher"] = matcher
    blocks.append(block)

# Repos with their own graphify hook (.claude/hooks/graphify-init.sh) register their own guards.
guard = 'PATH="$HOME/.local/bin:$PATH"; [ -f graphify-out/graph.json ] && [ ! -x .claude/hooks/graphify-init.sh ] && command -v graphify >/dev/null 2>&1 && graphify hook-guard {} || true'
add("SessionStart", None, f'"{session_hook}"', 90)
add("PreToolUse", "Bash|Grep", guard.format("search"), 10)
add("PreToolUse", "Read|Glob", guard.format("read"), 10)

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(s, f, indent=2)
    f.write("\n")
print(f"[agent-tools] updated {path}")
PY

# ── graphify MCP server at user scope (every project) ─────────────────────────
if command -v claude >/dev/null 2>&1 && command -v graphify-mcp >/dev/null 2>&1; then
  if ! claude mcp get graphify >/dev/null 2>&1; then
    claude mcp add --scope user graphify -- graphify-mcp graphify-out/graph.json >/dev/null 2>&1 \
      && log "graphify MCP server added (user scope)" || log "could not add graphify MCP server"
  fi
fi

log "done. Start a new Claude Code session; ponytail installs from its marketplace on first start."
