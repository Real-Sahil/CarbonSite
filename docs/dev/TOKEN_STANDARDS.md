# Token and cache standards for agent sessions

Measured from one long session (3,684 model calls, 16 compactions) with `pnpm tokens`. Numbers below are from that run; re-run the report after any large task and compare.

## What the numbers say

- **Caching works.** 98.1% of input tokens were cache reads. Do not spend effort on "improving the hit rate".
- **Cost is context size, not cache misses.** Every call re-reads the whole context. Median context was 436k tokens (p90 713k, max 835k), so 1.6 billion tokens were read to produce 3.1 million of output. Output is under 0.2% of the volume; terse replies barely move the bill.
- **A fixed floor of about 104k tokens** is in every call (system prompt, tool list, skills list, CLAUDE.md). CLAUDE.md alone is 189 KB, about 50k tokens, nearly half the floor.
- **89% of calls ran above 200k context.** 56% of all cache-read tokens were read above a 200k line. That is what compacting at 200k would have removed.
- **Avoidable cache writes** (30.6M tokens in total): 15 model switches wrote 7.9M (26%); 14 idle gaps over an hour wrote 7.4M (24%); 9 changes to the prompt prefix wrote 3.8M (12%).
- **Tool output kept in context:** Bash 1.2M tokens over 2,655 calls, web fetches 178k, notification reads 112k, GitHub Actions and PR reads about 220k.

## Rules

1. **Keep a working context under about 250k.** The project setting `autoCompactWindow` is 250000 (valid range 100k to 1M tokens; the same value can be set per machine with `CLAUDE_CODE_AUTO_COMPACT_WINDOW`), so Claude Code compacts on its own near that size. On the measured session that would have removed about 47% of cache reads; 200k removes 57% but compacts so often that, with a floor of about 68k, only about 100k is left for work between compactions. Finish a task, then `/compact` (or start a fresh session with a handoff note) before the next unrelated one. Never let a session drift to 500k+ because it is "still going".
2. **Do not switch models mid-session.** Each `/model` change rewrote about 500k tokens. Pick the model at the start. For cheap side work, use a subagent with its own model (`CLAUDE_CODE_SUBAGENT_MODEL` or the agent's `model`), which has a small context of its own.
3. **Compact before you walk away.** The cache lasts about an hour. After a longer idle the whole context is rewritten at the higher write price, so compact first and the rewrite is small. Do not "ping to keep warm": a ping reads the entire context.
4. **Do not edit the prompt prefix mid-task.** Editing CLAUDE.md, adding or removing an MCP server, or changing the tool list rewrites the cache from that point. Batch CLAUDE.md edits and do them at a task boundary.
5. **Bound tool output.** Pipe long shell output through `tail`, `grep -E` or `head`; ask for summaries, not logs; read a file by line range. Send research, web fetching and log reading to a subagent so only its conclusion enters the main context. Treat any single result over 10k tokens as a bug in the command.
6. **Keep CLAUDE.md small.** Target 15k tokens or less. Keep rules and pointers in it; move per-feature detail to `docs/` and read it when working on that feature. Every token in it is paid on every call. **Done 2026-10-11:** CLAUDE.md went from about 50k tokens to about 14k. The feature detail moved word for word into `docs/dev/features/` (index in CLAUDE.md). When a feature changes, update its file there, not CLAUDE.md; add to CLAUDE.md only a rule that applies everywhere. Re-run `pnpm tokens` on the next long session to confirm the floor dropped from about 104k to about 68k.
7. **Measure.** Run `pnpm tokens` at the end of a big task. Watch median context, calls above 200k, and large cache writes by cause.

## Settings worth setting

These names exist in Claude Code 2.1.296; the ranges below come from the CLI's own help and validation text.

- `autoCompactWindow` (settings) or `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (environment): the auto-compact window in tokens, 100k to 1M. **Set to 250000 in `.claude/settings.json`.** This is the lever for rule 1. (`--autocompact <auto|tokens>` does the same for one run.)
- `MAX_MCP_OUTPUT_TOKENS`: caps any single MCP tool result (rule 5).
- `CLAUDE_CODE_SUBAGENT_MODEL`: the model subagents use (rule 2).
- `ENABLE_TOOL_SEARCH`: keeps rarely used tool definitions out of the prompt until needed. Already on in practice here.

Trade-off: earlier compaction loses detail from the early part of a session. Compact at task boundaries, with a handoff note, rather than mid-task.

## Found on 11 October 2026: an environment override is already set

The cloud environment for this repo sets `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` in the `claude` process (not in any repo or user settings file). With a 1M-token window that is 800k, which matches the measured session: compactions happened at about 800k and the largest context was 835k. That, not the cache, is why contexts grew so large.

- It lives in the cloud environment settings (session title bar, then Edit), so a repo change cannot remove it.
- `autoCompactWindow` (250000) is now set in `.claude/settings.json`. Whether the 80% then applies to the 250k window (about 200k) or to the 1M default is **not verified**: it needs a long session to see. After the next one, run `pnpm tokens` and read the median and max context. About 200k to 250k means the setting works; 700k to 800k means the environment override wins.
- If the override wins, edit or remove the variable in the cloud environment settings, or set it to 25 (25% of 1M) as a stop-gap.
