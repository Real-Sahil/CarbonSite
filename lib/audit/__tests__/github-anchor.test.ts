import { describe, expect, it } from "vitest";
import { buildAnchorFile, findAnchorProblems, parseAnchorFile, type AnchorFile } from "@/lib/audit/github-anchor";

const prev: AnchorFile = {
  anchoredAt: "2026-10-23T00:00:00.000Z",
  heads: { a: { headSeq: "10", headHash: "h10" }, b: { headSeq: "4", headHash: "h4" } },
};

describe("parseAnchorFile", () => {
  it("returns null for missing, malformed or foreign content", () => {
    expect(parseAnchorFile(null)).toBeNull();
    expect(parseAnchorFile("not json")).toBeNull();
    expect(parseAnchorFile('{"heads":1}')).toBeNull();
  });
  it("keeps valid heads and drops malformed ones", () => {
    const text = JSON.stringify({ anchoredAt: "x", heads: { a: { headSeq: "1", headHash: "h" }, b: { headSeq: "-1", headHash: "h" } } });
    expect(parseAnchorFile(text)?.heads).toEqual({ a: { headSeq: "1", headHash: "h" } });
  });
});

describe("findAnchorProblems", () => {
  it("is clean with no earlier anchor", async () => {
    expect(await findAnchorProblems(null, async () => "x")).toEqual([]);
  });
  it("accepts a chain that still holds every anchored row", async () => {
    const rows: Record<string, string> = { "a:10": "h10", "b:4": "h4" };
    expect(await findAnchorProblems(prev, async (o, s) => rows[`${o}:${s}`])).toEqual([]);
  });
  it("reports a cut chain as truncated and a changed row as rewritten", async () => {
    const rows: Record<string, string> = { "b:4": "other" };
    const problems = await findAnchorProblems(prev, async (o, s) => rows[`${o}:${s}`]);
    expect(problems).toEqual([
      { organizationId: "a", kind: "truncated", headSeq: "10" },
      { organizationId: "b", kind: "rewritten", headSeq: "4", anchored: "h4", found: "other" },
    ]);
  });
});

describe("buildAnchorFile", () => {
  it("replaces heads for organisations seen now and keeps the rest", () => {
    const next = buildAnchorFile(prev, { a: { headSeq: "12", headHash: "h12" }, c: { headSeq: "1", headHash: "h1" } }, new Date("2026-10-30T00:00:00Z"));
    expect(next.heads).toEqual({
      a: { headSeq: "12", headHash: "h12" },
      b: { headSeq: "4", headHash: "h4" },
      c: { headSeq: "1", headHash: "h1" },
    });
    expect(next.anchoredAt).toBe("2026-10-30T00:00:00.000Z");
  });
});
