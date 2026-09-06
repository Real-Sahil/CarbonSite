import { describe, it, expect } from "vitest";
import { FRAMEWORK_DATAPOINTS } from "../framework-datapoints";
import { DATAPOINT_RESOLVERS } from "../datapoint-resolvers";

describe("FRAMEWORK_DATAPOINTS", () => {
  it("has no duplicate framework+code pairs", () => {
    const seen = new Set<string>();
    for (const dp of FRAMEWORK_DATAPOINTS) {
      const key = `${dp.framework}:${dp.code}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("gives every datapoint a non-empty title and description", () => {
    for (const dp of FRAMEWORK_DATAPOINTS) {
      expect(dp.title.length).toBeGreaterThan(0);
      expect(dp.description.length).toBeGreaterThan(0);
      expect(dp.category.length).toBeGreaterThan(0);
    }
  });

  it("only references resolver keys that actually exist", () => {
    for (const dp of FRAMEWORK_DATAPOINTS) {
      if (dp.resolverKey !== null) {
        expect(DATAPOINT_RESOLVERS[dp.resolverKey], `${dp.framework} ${dp.code} references unknown resolver "${dp.resolverKey}"`).toBeDefined();
      }
    }
  });

  it("covers all seven disclosure frameworks plus the GHG Protocol", () => {
    const frameworks = new Set(FRAMEWORK_DATAPOINTS.map((dp) => dp.framework));
    expect(frameworks).toEqual(
      new Set(["esrs_e1", "esrs_e3", "esrs_e5", "gri_305", "cdp_climate", "secr", "ifrs_s2", "ghg_protocol"]),
    );
  });

  it("has at least one narrative (unresolved) datapoint per framework with subjective disclosures", () => {
    // Governance and strategy narratives should never be force-mapped to a
    // resolver; confirm at least the frameworks with genuine narrative
    // requirements have at least one null resolverKey entry.
    const narrativeFrameworks = new Set(
      FRAMEWORK_DATAPOINTS.filter((dp) => dp.resolverKey === null).map((dp) => dp.framework),
    );
    expect(narrativeFrameworks.has("esrs_e1")).toBe(true);
    expect(narrativeFrameworks.has("ifrs_s2")).toBe(true);
    expect(narrativeFrameworks.has("secr")).toBe(true);
  });
});

describe("DATAPOINT_RESOLVERS", () => {
  it("is referenced by at least one seeded datapoint for every resolver key", () => {
    const usedKeys = new Set(FRAMEWORK_DATAPOINTS.map((dp) => dp.resolverKey).filter(Boolean));
    for (const key of Object.keys(DATAPOINT_RESOLVERS)) {
      expect(usedKeys.has(key), `Resolver "${key}" is defined but never used by a seeded datapoint`).toBe(true);
    }
  });
});
