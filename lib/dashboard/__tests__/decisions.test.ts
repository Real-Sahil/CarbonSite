import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECISION_ACTIONS, decisionSentence } from "../decisions";

/** Source files a writeAuditLog() call can live in: app and lib, minus tests and this mapping. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { recursive: true })
    .map(String)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__") && !f.endsWith("dashboard/decisions.ts"))
    .map((f) => join(dir, f));
}

describe("decisionSentence", () => {
  it("gives the written sentence for a known action", () => {
    expect(decisionSentence("snapshot.published")).toBe("Published a snapshot");
  });

  it("shows an unknown action by its own name, underscores as spaces", () => {
    expect(decisionSentence("tcfd.risk_deleted")).toBe("tcfd.risk deleted");
  });

  it("never reads an inherited property as a sentence", () => {
    expect(decisionSentence("constructor")).toBe("constructor");
    expect(typeof decisionSentence("__proto__")).toBe("string");
    expect(decisionSentence("toString")).toBe("toString");
  });
});

describe("DECISION_ACTIONS", () => {
  const source = [...sourceFiles("app"), ...sourceFiles("lib")].map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");

  it.each(DECISION_ACTIONS)("%s is written by a route or library in the codebase", (action) => {
    // A typo here would show a sentence for an action no code ever records.
    expect(source).toContain(`"${action}"`);
  });
});
