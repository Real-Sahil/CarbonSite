import { describe, expect, it } from "vitest";
import { socialPhase, type SocialInputs } from "../social-phase";

const none: SocialInputs = { sourcesConnected: false, firstDataProcessed: false, baselineRecorded: false, liveVariance: false };

describe("socialPhase", () => {
  it.each([
    [{}, "data_mapping"],
    [{ sourcesConnected: true }, "data_mapping"],
    [{ sourcesConnected: true, firstDataProcessed: true }, "initial_audit"],
    [{ firstDataProcessed: true, baselineRecorded: true }, "baseline_established"],
    [{ baselineRecorded: true, liveVariance: true }, "active_monitoring"],
    [{ liveVariance: true }, "data_mapping"],
  ] as [Partial<SocialInputs>, string][])("%j -> %s", (input, phase) => {
    expect(socialPhase({ ...none, ...input })).toBe(phase);
  });
});
