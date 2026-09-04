import { describe, it, expect } from "vitest";
import {
  scorePedigree,
  pedigreeGeometricStdDev,
  pedigreeToLegacyScore,
  pedigreeConfidenceInterval,
  type PedigreeScores,
} from "../pedigree";
import type { ActivityRecord } from "@prisma/client";

const record = (overrides: Partial<ActivityRecord> = {}) =>
  ({
    evidenceStatus: "complete",
    fieldSubmissionId: null,
    importBatchId: "batch-1",
    country: "GB",
    activityDate: new Date("2026-06-01"),
    ...overrides,
  }) as unknown as Pick<
    ActivityRecord,
    "evidenceStatus" | "fieldSubmissionId" | "importBatchId" | "country" | "activityDate"
  >;

describe("scorePedigree", () => {
  it("gives the best reliability score to a photographed field submission", () => {
    const scores = scorePedigree({
      record: record({ fieldSubmissionId: "fs-1" }),
      factorSelection: null,
      unitConverted: false,
      unitConversionComplex: false,
    });
    expect(scores.reliability).toBe(1);
  });

  it("gives the worst reliability score to a record with no evidence and no import batch", () => {
    const scores = scorePedigree({
      record: record({ evidenceStatus: "missing", importBatchId: null }),
      factorSelection: null,
      unitConverted: false,
      unitConversionComplex: false,
    });
    expect(scores.reliability).toBe(5);
  });

  it("scores geographical correlation 1 when factor and record country match", () => {
    const scores = scorePedigree({
      record: record({ country: "GB" }),
      factorSelection: {
        factor: { geographyCountry: "GB" } as any,
        selectionReason: "matched",
      },
      unitConverted: false,
      unitConversionComplex: false,
    });
    expect(scores.geographicalCorrelation).toBe(1);
  });

  it("scores geographical correlation worse when factor country differs from record country", () => {
    const scores = scorePedigree({
      record: record({ country: "GB" }),
      factorSelection: {
        factor: { geographyCountry: "US" } as any,
        selectionReason: "matched",
      },
      unitConverted: false,
      unitConversionComplex: false,
    });
    expect(scores.geographicalCorrelation).toBe(4);
  });

  it("scores temporal correlation by years between factor vintage and activity date", () => {
    const near = scorePedigree({
      record: record({ activityDate: new Date("2026-06-01") }),
      factorSelection: {
        factor: { effectiveStartDate: new Date("2026-01-01") } as any,
        selectionReason: "matched",
      },
      unitConverted: false,
      unitConversionComplex: false,
    });
    const far = scorePedigree({
      record: record({ activityDate: new Date("2026-06-01") }),
      factorSelection: {
        factor: { effectiveStartDate: new Date("2015-01-01") } as any,
        selectionReason: "matched",
      },
      unitConverted: false,
      unitConversionComplex: false,
    });
    expect(near.temporalCorrelation).toBeLessThan(far.temporalCorrelation);
  });

  it("worsens technological correlation for a complex unit conversion even with a strong text match", () => {
    const noConversion = scorePedigree({
      record: record(),
      factorSelection: { factor: {} as any, selectionReason: "matched matched matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });
    const complexConversion = scorePedigree({
      record: record(),
      factorSelection: { factor: {} as any, selectionReason: "matched matched matched" },
      unitConverted: true,
      unitConversionComplex: true,
    });
    expect(complexConversion.technologicalCorrelation).toBeGreaterThan(
      noConversion.technologicalCorrelation,
    );
  });
});

describe("pedigreeGeometricStdDev", () => {
  it("is smallest for the best possible pedigree (all 1s)", () => {
    const best: PedigreeScores = {
      reliability: 1,
      completeness: 1,
      temporalCorrelation: 1,
      geographicalCorrelation: 1,
      technologicalCorrelation: 1,
    };
    const worst: PedigreeScores = {
      reliability: 5,
      completeness: 5,
      temporalCorrelation: 5,
      geographicalCorrelation: 5,
      technologicalCorrelation: 5,
    };
    expect(pedigreeGeometricStdDev(best)).toBeLessThan(pedigreeGeometricStdDev(worst));
    expect(pedigreeGeometricStdDev(best)).toBeGreaterThan(1);
  });
});

describe("pedigreeToLegacyScore", () => {
  it("maps the best pedigree to 100 and the worst to 0", () => {
    const best: PedigreeScores = {
      reliability: 1,
      completeness: 1,
      temporalCorrelation: 1,
      geographicalCorrelation: 1,
      technologicalCorrelation: 1,
    };
    const worst: PedigreeScores = {
      reliability: 5,
      completeness: 5,
      temporalCorrelation: 5,
      geographicalCorrelation: 5,
      technologicalCorrelation: 5,
    };
    expect(pedigreeToLegacyScore(best)).toBe(100);
    expect(pedigreeToLegacyScore(worst)).toBe(0);
  });
});

describe("pedigreeConfidenceInterval", () => {
  it("widens as geometric standard deviation increases", () => {
    const tight = pedigreeConfidenceInterval(100, 1.05);
    const wide = pedigreeConfidenceInterval(100, 1.5);
    expect(wide.upper - wide.lower).toBeGreaterThan(tight.upper - tight.lower);
  });

  it("is centered on the point estimate on a log scale", () => {
    const ci = pedigreeConfidenceInterval(200, 1.3);
    expect(ci.lower * ci.upper).toBeCloseTo(200 * 200, 2);
  });
});
