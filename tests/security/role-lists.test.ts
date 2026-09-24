// @vitest-environment node
// Role lists on org routes come from ROLE_GROUPS (lib/auth/session.ts). A
// hand-written list such as ("admin", "editor") silently denied the
// sustainability_director and sustainability_manager roles added later, and
// one route allowed "viewer" alone, locking admins out. This scan fails on
// both patterns so new routes use the shared groups.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name === "__tests__") return [];
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

const CALL = /requireOrgMember\(\s*[^,()]+?\s*,\s*([^()]*?)\)/gs;

function findings(): string[] {
  const out: string[] = [];
  for (const file of ROOTS.flatMap(sourceFiles)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(CALL)) {
      const args = m[1];
      const literals = [...args.matchAll(/["']([a-z_]+)["']/g)].map((l) => l[1]);
      if (literals.includes("editor")) out.push(`${file}: literal "editor" (use ROLE_GROUPS.editor / reviewersAndEditors / dataReaders)`);
      if (!args.includes("...") && literals.length > 0 && !literals.includes("admin")) {
        out.push(`${file}: role list without "admin": ${literals.join(", ")}`);
      }
    }
  }
  return out;
}

describe("requireOrgMember role lists", () => {
  it("use ROLE_GROUPS for editor-level access and always admit admins", () => {
    expect(findings()).toEqual([]);
  });
});
