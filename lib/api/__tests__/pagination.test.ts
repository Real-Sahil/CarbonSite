import { describe, expect, it } from "vitest";
import { cursorPage, offsetPage, pageHref, wholeNumberParam, MAX_OFFSET, MAX_PAGE_SIZE } from "../pagination";

describe("wholeNumberParam", () => {
  it("falls back for missing, empty or malformed values, never NaN", () => {
    expect(wholeNumberParam(null, 25, 1, 100)).toBe(25);
    expect(wholeNumberParam("", 25, 1, 100)).toBe(25);
    expect(wholeNumberParam("abc", 25, 1, 100)).toBe(25);
    expect(wholeNumberParam("-3", 25, 1, 100)).toBe(25);
    expect(wholeNumberParam("1.5", 25, 1, 100)).toBe(25);
    expect(wholeNumberParam("12abc", 25, 1, 100)).toBe(25);
  });

  it("clamps to the range", () => {
    expect(wholeNumberParam("0", 25, 1, 100)).toBe(1);
    expect(wholeNumberParam("5000", 25, 1, 100)).toBe(100);
    expect(wholeNumberParam(" 40 ", 25, 1, 100)).toBe(40);
  });
});

describe("offsetPage", () => {
  it("defaults to 50 rows from the start", () => {
    expect(offsetPage(new URLSearchParams())).toEqual({ limit: 50, offset: 0 });
  });

  it("never returns more than the maximum page or a runaway offset", () => {
    const p = offsetPage(new URLSearchParams("limit=100000&offset=999999999"));
    expect(p.limit).toBe(MAX_PAGE_SIZE);
    expect(p.offset).toBe(MAX_OFFSET);
  });

  it("honours a custom default and maximum", () => {
    expect(offsetPage(new URLSearchParams(), { defaultLimit: 25, maxLimit: 20 }).limit).toBe(25);
    expect(offsetPage(new URLSearchParams("limit=50"), { defaultLimit: 25, maxLimit: 20 }).limit).toBe(20);
  });
});

describe("cursorPage", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }));

  it("returns no cursor when the rows fit the page", () => {
    expect(cursorPage(rows(3), 5)).toEqual({ items: rows(3), hasMore: false, nextCursor: null });
  });

  it("cursors on the last row returned, so the next page starts after it", () => {
    // Fetched with take: limit + 1 (here limit 3, so four rows came back).
    const page = cursorPage(rows(4), 3);
    expect(page.items.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("r3");
  });
});

describe("pageHref", () => {
  it("encodes values and drops empty ones", () => {
    expect(pageHref("/a/audit", { actor: "a&b c", action: "", since: undefined, offset: 100 })).toBe(
      "/a/audit?actor=a%26b+c&offset=100",
    );
  });

  it("returns the bare path when nothing is set", () => {
    expect(pageHref("/a/audit", { action: undefined })).toBe("/a/audit");
  });
});
