import { describe, expect, it } from "vitest";
import { STARTER_TOPICS, basisOf, compositeScore, isMaterialByScore, materialByStandard, missingStarterTopics } from "../index";

describe("scoring", () => {
  it("takes the higher of the two scores and is null when unscored", () => {
    expect(compositeScore({ impactScore: 2, financialScore: 4 })).toBe(4);
    expect(compositeScore({ impactScore: 2, financialScore: null })).toBe(2);
    expect(compositeScore({ impactScore: null, financialScore: null })).toBeNull();
  });

  it("is material when either dimension reaches the threshold, and not while unscored", () => {
    expect(isMaterialByScore({ impactScore: 3, financialScore: 1 })).toBe(true);
    expect(isMaterialByScore({ impactScore: 1, financialScore: 4 })).toBe(true);
    expect(isMaterialByScore({ impactScore: 2, financialScore: 2 })).toBe(false);
    expect(isMaterialByScore({ impactScore: null, financialScore: null })).toBe(false);
  });

  it("honours the organisation's own threshold", () => {
    expect(isMaterialByScore({ impactScore: 3, financialScore: 3 }, 4)).toBe(false);
    expect(isMaterialByScore({ impactScore: 4, financialScore: 1 }, 4)).toBe(true);
  });

  it("says which dimension makes a topic material", () => {
    expect(basisOf({ impactScore: 4, financialScore: 1 })).toBe("impact");
    expect(basisOf({ impactScore: 1, financialScore: 5 })).toBe("financial");
    expect(basisOf({ impactScore: 3, financialScore: 3 })).toBe("both");
    expect(basisOf({ impactScore: 1, financialScore: 1 })).toBeNull();
  });
});

describe("starter topics", () => {
  it("covers the five environmental, four social and governance standards, each name once", () => {
    const codes = new Set(STARTER_TOPICS.map((t) => t.esrsCode));
    expect([...codes].sort()).toEqual(["E1", "E2", "E3", "E4", "E5", "G1", "S1", "S2", "S3", "S4"]);
    expect(new Set(STARTER_TOPICS.map((t) => t.topicName)).size).toBe(STARTER_TOPICS.length);
  });

  it("offers only the ones an assessment lacks, ignoring case", () => {
    const left = missingStarterTopics(["climate change mitigation", "Energy"]);
    expect(left).toHaveLength(STARTER_TOPICS.length - 2);
    expect(left.some((t) => t.topicName === "Energy")).toBe(false);
  });
});

describe("materialByStandard", () => {
  const t = (over: object) => ({ esrsCode: "E1", topicName: "x", iroType: "impact", impactScore: 3, financialScore: null, isMaterial: true, rationale: null, ...over });
  it("keeps only material topics, grouped in standard order with own topics last, strongest first", () => {
    const groups = materialByStandard([
      t({ topicName: "own", esrsCode: null }),
      t({ topicName: "weak", impactScore: 3 }),
      t({ topicName: "strong", impactScore: 5 }),
      t({ topicName: "social", esrsCode: "S1" }),
      t({ topicName: "skipped", isMaterial: false }),
    ]);
    expect(groups.map((g) => g.code)).toEqual(["E1", "S1", "Own topics"]);
    expect(groups[0].topics.map((x) => x.topicName)).toEqual(["strong", "weak"]);
    expect(groups.flatMap((g) => g.topics).some((x) => x.topicName === "skipped")).toBe(false);
  });
});
