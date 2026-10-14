import { describe, expect, it } from "vitest";
import { typeStepMs } from "@/components/marketing/kit";

describe("typeStepMs", () => {
  it("types a line in about 1.6 s, between 18 and 45 ms a character", () => {
    expect(typeStepMs(29)).toBe(45);
    expect(typeStepMs(50)).toBe(32);
    expect(typeStepMs(100)).toBe(18);
    expect(typeStepMs(0)).toBe(45);
  });
});
