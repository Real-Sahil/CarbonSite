import { describe, expect, it } from "vitest";
import { scopeEmptyState } from "../empty-state";

const base = { orgId: "org_1", periodLabel: "Q3 2026" };

describe("scopeEmptyState", () => {
  // Reproduction: a calculation ran and the period has figures, but the
  // project filter matches none of them. The panel used to say "no calculation
  // run" and offer "Run calculation", which is false and sends people to the
  // wrong fix.
  it("does not claim the period has no calculation when a project filter empties it", () => {
    const copy = scopeEmptyState({ ...base, calculated: true, hasFigures: true, projectName: "Harbour Yard" });
    expect(copy.title).toBe("No calculated figures for Harbour Yard");
    expect(copy.description).not.toContain("no calculation run");
    expect(copy.href).toBeUndefined();
    expect(copy.action).toBeUndefined();
  });

  it("names the project and says how to see the whole period", () => {
    const copy = scopeEmptyState({ ...base, calculated: true, hasFigures: true, projectName: "Harbour Yard" });
    expect(copy.description).toContain("Harbour Yard");
    expect(copy.description).toContain("Choose All projects");
  });

  it("says there is no calculation run only when no live rollups exist", () => {
    const copy = scopeEmptyState({ ...base, calculated: false, hasFigures: false, projectName: null });
    expect(copy.title).toBe("No calculated figures for this period yet");
    expect(copy.description).toBe("Q3 2026 has no calculation run. Approve records, then run a calculation to fill the scope, category, trend and intelligence panels.");
    expect(copy.href).toBe("#run-calculation");
    expect(copy.action).toBe("Run calculation");
  });

  it("uses the generic name when the period has no label", () => {
    const copy = scopeEmptyState({ orgId: "org_1", periodLabel: null, calculated: false, hasFigures: false, projectName: null });
    expect(copy.description.startsWith("The current period has no calculation run.")).toBe(true);
  });

  it("says the run counted nothing when the rollups hold no figures", () => {
    const copy = scopeEmptyState({ ...base, calculated: true, hasFigures: false, projectName: null });
    expect(copy.title).toBe("The calculation counted no emissions");
    expect(copy.description).not.toContain("no calculation run");
    expect(copy.href).toBe("/orgs/org_1/records");
  });

  it("states a filter with no project name matches nothing, and offers no link", () => {
    const copy = scopeEmptyState({ ...base, calculated: true, hasFigures: true, projectName: null });
    expect(copy.title).toBe("No calculated figures match these filters");
    expect(copy.description).toContain("Clear a filter");
    expect(copy.href).toBeUndefined();
    expect(copy.action).toBeUndefined();
  });
});
