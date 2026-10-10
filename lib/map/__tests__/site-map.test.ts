import { describe, expect, it } from "vitest";
import { fitProjection, hasPosition, projectSiteTotals, radiusFor, siteTotals, snapshotOrder } from "../site-map";

describe("siteTotals", () => {
  it("sums the per-scope rows of a facility, keeps facilities with none, and biggest first", () => {
    const rows = siteTotals(
      [{ id: "f1", name: "Leeds", latitude: "53.8", longitude: "-1.55" }, { id: "f2", name: "Bristol", latitude: null, longitude: null }, { id: "f3", name: "Cardiff", latitude: 51.48, longitude: -3.18 }],
      [{ facilityId: "f1", totalCo2e: "100", recordCount: 2 }, { facilityId: "f1", totalCo2e: 50, recordCount: 1 }, { facilityId: "f2", totalCo2e: 20, recordCount: 1 }, { facilityId: null, totalCo2e: 999, recordCount: 9 }],
    );
    expect(rows.map((r) => [r.id, r.kg, r.recordCount])).toEqual([["f1", 150, 3], ["f2", 20, 1], ["f3", 0, 0]]);
    expect(rows[0].latitude).toBe(53.8);
  });

  it("only treats real coordinates as a position", () => {
    const base = { id: "x", name: "x", kg: 0, recordCount: 0 };
    expect(hasPosition({ ...base, latitude: 53, longitude: -1 })).toBe(true);
    expect(hasPosition({ ...base, latitude: null, longitude: -1 })).toBe(false);
    expect(hasPosition({ ...base, latitude: 120, longitude: 0 })).toBe(false);
  });
});

describe("snapshotOrder", () => {
  it("orders by period then version", () => {
    const s = (id: string, periodStart: string, version: number) => ({ id, label: id, version, publishedAt: `2026-0${version}-01`, periodStart });
    expect(snapshotOrder([s("c", "2025-01-01", 2), s("a", "2024-01-01", 1), s("b", "2025-01-01", 1)]).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("radiusFor and fitProjection", () => {
  it("scales marker area with emissions and never vanishes", () => {
    expect(radiusFor(0, 100)).toBe(5);
    expect(radiusFor(100, 100)).toBe(28);
    expect(radiusFor(25, 100)).toBeCloseTo(14);
  });

  it("fits positioned sites inside the box, north up, and centres a single site", () => {
    const pts = [{ latitude: 53.8, longitude: -1.55 }, { latitude: 51.48, longitude: -3.18 }];
    const p = fitProjection(pts, 400, 300);
    const a = p(pts[0]), b = p(pts[1]);
    expect(a.y).toBeLessThan(b.y);
    expect(a.x).toBeGreaterThan(b.x);
    for (const q of [a, b]) { expect(q.x).toBeGreaterThanOrEqual(0); expect(q.x).toBeLessThanOrEqual(400); expect(q.y).toBeGreaterThanOrEqual(0); expect(q.y).toBeLessThanOrEqual(300); }
    const one = fitProjection([pts[0]], 400, 300)(pts[0]);
    expect(one).toEqual({ x: 200, y: 150 });
  });
});

describe("projectSiteTotals positions", () => {
  const site = { id: "s1", name: "Yard", projectId: "p1", projectName: "Bridge", postcode: "LS1 1AA", city: null };
  const fromPostcode = () => ({ latitude: 53.8, longitude: -1.55 });
  it("uses the position chosen from address search over the postcode", () => {
    const [t] = projectSiteTotals([{ ...site, latitude: 51.5, longitude: -0.12 }], [], fromPostcode);
    expect([t.latitude, t.longitude]).toEqual([51.5, -0.12]);
  });
  it("falls back to the postcode, and leaves a site with neither unplaced", () => {
    expect(projectSiteTotals([site], [], fromPostcode)[0].latitude).toBe(53.8);
    expect(projectSiteTotals([{ ...site, postcode: null }], [], () => null)[0].latitude).toBeNull();
  });
});
