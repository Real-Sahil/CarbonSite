import { describe, expect, it } from "vitest";
import { MAX_INTERRUPTED_ATTEMPTS, interruptionsExhausted } from "../interruption";

describe("interruptionsExhausted", () => {
  it("lets a run resume while it has been interrupted fewer times than the cap", () => {
    for (let n = 0; n < MAX_INTERRUPTED_ATTEMPTS; n++) {
      expect(interruptionsExhausted(n)).toBe(false);
    }
  });

  it("fails the run at the cap and beyond", () => {
    expect(interruptionsExhausted(MAX_INTERRUPTED_ATTEMPTS)).toBe(true);
    expect(interruptionsExhausted(MAX_INTERRUPTED_ATTEMPTS + 5)).toBe(true);
  });

  it("allows two recoveries before the third interruption fails the run", () => {
    expect(MAX_INTERRUPTED_ATTEMPTS).toBe(3);
  });
});
