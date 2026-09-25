import { describe, expect, it } from "vitest";
import {
  attendanceDate,
  attendanceEvidenceCsv,
  commuteTotals,
  groupAttendance,
  kmByMode,
  modeSplit,
  parseAttendance,
  postcodeDistrict,
  type SurveyAnswer,
} from "../attendance";

// A fictional MSite-style export: names and full postcodes, which must not survive.
const EXPORT = [
  { "Sign In": "03/03/2026 07:02", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "03/03/2026 12:40", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "04/03/2026 07:05", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "03/03/2026 07:10", Name: "B. Worker", "Operative ID": "202", Company: "Groundworks Sub Ltd", "Home Postcode": "LS1 4DY" },
  { "Sign In": "01/04/2026 07:10", Name: "C. Worker", "Operative ID": "303", Company: "Northgate Civils Ltd", "Home Postcode": "" },
  { "Sign In": "not a date", Name: "D", "Operative ID": "404", Company: "Northgate Civils Ltd", "Home Postcode": "S1 2AA" },
];

describe("reading attendance exports", () => {
  it("keeps only the postcode district", () => {
    expect(postcodeDistrict("hd9 7ab")).toBe("HD9");
    expect(postcodeDistrict("SW1A1AA")).toBe("SW1A");
    expect(postcodeDistrict("LS1")).toBe("LS1");
    expect(postcodeDistrict("not a postcode")).toBeNull();
  });

  it("reads UK, ISO and Excel dates, and rejects impossible ones", () => {
    expect(attendanceDate("03/04/2026 07:00")).toBe("2026-04-03");
    expect(attendanceDate("2026-04-03T07:00:00Z")).toBe("2026-04-03");
    expect(attendanceDate(46115)).toBe("2026-04-03");
    expect(attendanceDate("31/02/2026")).toBeNull();
  });

  it("finds the columns, counts repeat sign-ins once and drops unreadable dates", () => {
    const p = parseAttendance(EXPORT);
    expect(p.columns).toEqual({ date: "Sign In", worker: "Operative ID", employer: "Company", postcode: "Home Postcode" });
    expect(p.rows).toHaveLength(4);
    expect(p.skipped).toBe(1);
    expect(JSON.stringify(p.rows)).not.toMatch(/7AB|Worker/);
    expect(p.warnings.join(" ")).toMatch(/1 repeat sign-in on/);
  });
});

describe("commuting kilometres", () => {
  const rows = parseAttendance(EXPORT).rows;
  const months = groupAttendance(rows, ["northgate civils ltd"]);

  it("splits own staff from subcontractors by month and district", () => {
    expect(months.map((m) => m.month)).toEqual(["2026-03", "2026-04"]);
    expect(months[0].own).toEqual([{ district: "HD9", days: 2, people: 1 }]);
    expect(months[0].subcontractor).toEqual([{ district: "LS1", days: 1, people: 1 }]);
  });

  it("returns journeys, averages unknown districts and leaves out lodging", () => {
    const km = new Map<string, number | null>([["HD9", 20], ["FAR", 200]]);
    const t = commuteTotals(
      [{ district: "HD9", days: 10, people: 2 }, { district: null, days: 5, people: 1 }, { district: "FAR", days: 4, people: 1 }],
      km,
    );
    // 10 days x 2 x 20 km, plus 5 days at the 40 km average day.
    expect(t.personKm).toBe(600);
    expect(t).toMatchObject({ days: 19, measuredDays: 10, averagedDays: 5, lodgingDays: 4 });
  });

  it("defaults to driving alone until the survey has enough answers", () => {
    const few: SurveyAnswer[] = [{ mode: "bus", occupancy: 1, workforce: "own" }];
    expect(modeSplit(few, "own").weights).toEqual({ car: 1 });
  });

  it("divides shared vehicles by the people in them and drops cycling", () => {
    const answers: SurveyAnswer[] = [
      { mode: "van", occupancy: 3, workforce: "own" },
      { mode: "van", occupancy: 3, workforce: "own" },
      { mode: "van", occupancy: 3, workforce: "own" },
      { mode: "car", occupancy: 1, workforce: "own" },
      { mode: "rail", occupancy: 1, workforce: "own" },
      { mode: "active", occupancy: 1, workforce: "own" },
    ];
    const split = modeSplit(answers, "own");
    // Three people sharing one van make one van journey: 3 x 1/3 of 6 answers.
    expect(split.weights.car).toBeCloseTo((1 + 1) / 6);
    expect(split.vans).toBe(true);
    expect(kmByMode(600, split)).toEqual([
      { mode: "car", km: 200 },
      { mode: "rail", km: 100 },
    ]);
  });

  it("keeps aggregates only in the evidence", () => {
    const csv = attendanceEvidenceCsv(months[0], new Map([["HD9", 20], ["LS1", 30]]), new Map([["HD9", "district_centre_road_route"]]));
    expect(csv).toContain("2026-03,own,HD9,2,1,20.0,district_centre_road_route,counted");
    expect(csv).toContain("subcontractor,LS1");
    expect(csv).not.toMatch(/Worker|7AB|101/);
  });
});

describe("reading files", () => {
  it("reads CSV dates day-first, not as US dates", async () => {
    const { readAttendanceFile } = await import("../import");
    const csv = "Date,Operative ID,Company,Postcode\n04/03/2025 07:05,1,Us Ltd,HD9 7AB\n01/04/2025,2,Us Ltd,HD9 7AB\n";
    const p = readAttendanceFile(Buffer.from(csv));
    expect(p.rows.map((r) => r.date)).toEqual(["2025-03-04", "2025-04-01"]);
  });
});
