# Hand-Off: CarbonSite Graphify Automation Setup

**Date:** 2026-08-21  
**Session:** Claude Code Remote  
**Branch:** main

## Summary

Initiated setup for automated daily knowledge graph updates using Graphify. The routine configuration is complete but requires interactive UI approval to finalize.

## Current State

### Knowledge Graph Status
- **Last update:** `graphify update .` run successfully
- **Nodes:** 4,228 (up from 2,403)
- **Edges:** 8,557 (up from 4,238)
- **Communities:** 305 (up from 160)
- **Backup location:** `graphify-out/2026-08-21/`
- **Latest commit:** `d59eb77` - "Update knowledge graph with light palette redesign changes"

### Configuration Changes
- ✅ Updated `.claude/settings.json` with permissions for Claude Code Remote trigger tools:
  - `mcp__Claude_Code_Remote__create_trigger`
  - `mcp__Claude_Code_Remote__list_triggers`
  - `mcp__Claude_Code_Remote__update_trigger`
  - `mcp__Claude_Code_Remote__delete_trigger`
  - `mcp__Claude_Code_Remote__fire_trigger`

## Pending: Graphify Daily Routine

### Configured Routine Details
- **Name:** CarbonSite Graphify Daily Update
- **Schedule:** 2 AM UTC daily (`0 2 * * *`)
- **Scope:** Project-scoped (CarbonSite only, not global)
- **Task:**
  1. Run `graphify update .` in `/home/user/CarbonSite`
  2. Commit changes: `git add graphify-out/ && git commit -m "Scheduled graphify knowledge graph update"`
  3. Push to `origin/main`
  4. Skip commit/push if no changes detected
- **Notifications:** Push notification on completion

### Required Action
The routine requires final approval through the Claude Code UI:
1. Visit `claude.ai/code`
2. Look for a permission request prompt for `mcp__Claude_Code_Remote__create_trigger`
3. Click **Approve** to authorize routine creation
4. The routine will then be active and fire daily at 2 AM UTC

**Note:** This is project-scoped automation — it will not affect other projects.

## Files Modified
- `.claude/settings.json` — added permissions for routine management tools

## Next Steps
1. Approve the permission prompt in Claude Code UI
2. Routine will automatically fire daily at 2 AM UTC
3. Knowledge graph will stay in sync with code changes
4. Results committed and pushed to main branch automatically

## Context
This setup enables automatic knowledge graph maintenance without manual intervention. The graph is used for codebase navigation, architecture understanding, and cross-file relationship discovery via `/graphify query` commands.
