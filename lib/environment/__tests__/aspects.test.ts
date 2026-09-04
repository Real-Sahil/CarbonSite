import { describe, it, expect } from "vitest";
import {
  clampScore,
  significanceScore,
  rateSignificance,
  requiresControl,
  summariseAspectRegister,
} from "../aspects";

describe("clampScore", () => {
  it("holds scores inside the 1 to 5 band", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-3)).toBe(1);
    expect(clampScore(9)).toBe(5);
    expect(clampScore(3)).toBe(3);
  });

  it("rounds fractional input", () => {
    expect(clampScore(3.4)).toBe(3);
    expect(clampScore(3.6)).toBe(4);
  });

  it("falls back to the minimum for non-finite input", () => {
    expect(clampScore(Number.NaN)).toBe(1);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(5);
  });
});

describe("significanceScore", () => {
  it("multiplies the three inputs", () => {
    expect(significanceScore({ severityScore: 3, likelihoodScore: 4, legalScore: 2 })).toBe(24);
  });

  it("bottoms out at 1 and tops out at 125", () => {
    expect(significanceScore({ severityScore: 1, likelihoodScore: 1, legalScore: 1 })).toBe(1);
    expect(significanceScore({ severityScore: 5, likelihoodScore: 5, legalScore: 5 })).toBe(125);
  });

  it("clamps out-of-range inputs before multiplying", () => {
    expect(significanceScore({ severityScore: 99, likelihoodScore: 1, legalScore: 1 })).toBe(5);
  });
});

describe("rateSignificance", () => {
  it("rates a maximum legal exposure as significant whatever the likelihood", () => {
    // A statutory limit breach is significant by definition even if rare.
    expect(rateSignificance({ severityScore: 1, likelihoodScore: 1, legalScore: 5 })).toBe(
      "significant",
    );
  });

  it("bands the score when legal exposure is not maximal", () => {
    expect(rateSignificance({ severityScore: 1, likelihoodScore: 1, legalScore: 1 })).toBe("low");
    expect(rateSignificance({ severityScore: 3, likelihoodScore: 2, legalScore: 2 })).toBe(
      "medium",
    );
    expect(rateSignificance({ severityScore: 4, likelihoodScore: 4, legalScore: 2 })).toBe("high");
    expect(rateSignificance({ severityScore: 4, likelihoodScore: 4, legalScore: 4 })).toBe(
      "significant",
    );
  });

  it("puts band boundaries where the thresholds say", () => {
    // 12 is the bottom of medium, 30 the bottom of high, 60 of significant.
    expect(rateSignificance({ severityScore: 3, likelihoodScore: 4, legalScore: 1 })).toBe(
      "medium",
    );
    expect(rateSignificance({ severityScore: 5, likelihoodScore: 3, legalScore: 2 })).toBe("high");
    expect(rateSignificance({ severityScore: 4, likelihoodScore: 5, legalScore: 3 })).toBe(
      "significant",
    );
  });
});

describe("requiresControl", () => {
  it("requires a documented control for high and significant aspects", () => {
    expect(requiresControl("significant")).toBe(true);
    expect(requiresControl("high")).toBe(true);
    expect(requiresControl("medium")).toBe(false);
    expect(requiresControl("low")).toBe(false);
  });
});

describe("summariseAspectRegister", () => {
  const NOW = new Date("2026-06-15T00:00:00Z");

  it("flags significant aspects with nothing recorded against them", () => {
    const summary = summariseAspectRegister(
      [
        {
          significance: "significant",
          existingControls: null,
          furtherAction: null,
          nextReviewOn: null,
        },
        {
          significance: "high",
          existingControls: "Bunded storage inspected weekly.",
          furtherAction: null,
          nextReviewOn: null,
        },
        {
          significance: "low",
          existingControls: null,
          furtherAction: null,
          nextReviewOn: null,
        },
      ],
      NOW,
    );

    expect(summary.total).toBe(3);
    expect(summary.bySignificance.significant).toBe(1);
    expect(summary.bySignificance.high).toBe(1);
    // Only the uncontrolled significant one counts; the high one has a control
    // and the low one does not require any.
    expect(summary.uncontrolledSignificant).toBe(1);
  });

  it("accepts further action in place of an existing control", () => {
    const summary = summariseAspectRegister(
      [
        {
          significance: "significant",
          existingControls: null,
          furtherAction: "Install interceptor by Q3.",
          nextReviewOn: null,
        },
      ],
      NOW,
    );
    expect(summary.uncontrolledSignificant).toBe(0);
  });

  it("ignores whitespace-only controls", () => {
    const summary = summariseAspectRegister(
      [
        {
          significance: "significant",
          existingControls: "   ",
          furtherAction: "  ",
          nextReviewOn: null,
        },
      ],
      NOW,
    );
    expect(summary.uncontrolledSignificant).toBe(1);
  });

  it("counts overdue reviews", () => {
    const summary = summariseAspectRegister(
      [
        {
          significance: "low",
          existingControls: null,
          furtherAction: null,
          nextReviewOn: new Date("2026-01-01"),
        },
        {
          significance: "low",
          existingControls: null,
          furtherAction: null,
          nextReviewOn: new Date("2027-01-01"),
        },
      ],
      NOW,
    );
    expect(summary.overdueReviews).toBe(1);
  });
});
