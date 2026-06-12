import { describe, expect, it } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-under-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks requests over the limit and reports retry-after", () => {
    const key = `test-over-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    rateLimit(keyA, 1, 60_000);
    expect(rateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  it("resets after the window expires", () => {
    const key = `test-reset-${Math.random()}`;
    rateLimit(key, 1, 1); // 1ms window
    const before = Date.now();
    while (Date.now() - before < 5) {
      /* spin past the window */
    }
    expect(rateLimit(key, 1, 1).allowed).toBe(true);
  });

  it("decrements remaining correctly", () => {
    const key = `test-remaining-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
  });
});
