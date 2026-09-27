import { describe, expect, it } from "vitest";
import {
  attendanceDate,
  commuteEvidenceCsv,
  groupAttendance,
  kmByMode,
  parseAttendance,
  personKm,
  surveyDistances,
  type SurveyAnswer,
} from "../attendance";

// A fictional MSite-style export: names and home postcodes, which must not survive.
const EXPORT = [
  { "Sign In": "03/03/2026 07:02", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "03/03/2026 12:40", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "04/03/2026 07:05", Name: "A. Worker", "Operative ID": "101", Company: "Northgate Civils Ltd", "Home Postcode": "HD9 7AB" },
  { "Sign In": "03/03/2026 07:10", Name: "B. Worker", "Operative ID": "202", Company: "Groundworks Sub Ltd", "Home Postcode": "LS1 4DY" },
  { "Sign In": "01/04/2026 07:10", Name: "C. Worker", "Operative ID": "303", Company: "Northgate Civils Ltd", "Home Postcode": "" },
  { "Sign In": "not a date", Name: "D", "Operative ID": "404", Company: "Northgate Civils Ltd", "Home Postcode": "S1 2AA" },
];

const answer = (mode: SurveyAnswer["mode"], roundTripKm: number | null, occupancy = 1, workforce: SurveyAnswer["workforce"] = "own"): SurveyAnswer => ({
  mode, occupancy, workforce, roundTripKm,
});

describe("reading attendance exports", () => {
  it("reads UK, ISO and Excel dates, and rejects impossible ones", () => {
    expect(attendanceDate("03/04/2026 07:00")).toBe("2026-04-03");
    expect(attendanceDate("2026-04-03T07:00:00Z")).toBe("2026-04-03");
    expect(attendanceDate(46115)).toBe("2026-04-03");
    expect(attendanceDate("31/02/2026")).toBeNull();
  });

  it("finds the columns, counts repeat sign-ins once and drops unreadable dates", () => {
    const p = parseAttendance(EXPORT);
    expect(p.columns).toEqual({ date: "Sign In", worker: "Operative ID", employer: "Company" });
    expect(p.rows).toHaveLength(4);
    expect(p.skipped).toBe(1);
    expect(p.warnings.join(" ")).toMatch(/1 repeat sign-in on/);
  });

  it("never reads home postcodes", () => {
    const p = parseAttendance(EXPORT);
    expect(p.ignoredPostcode).toBe("Home Postcode");
    expect(JSON.stringify(p.rows)).not.toMatch(/HD9|LS1|7AB|Worker/);
    expect(p.warnings.join(" ")).toMatch(/"Home Postcode" column was not read/);
  });
});

describe("commuting kilometres", () => {
  const rows = parseAttendance(EXPORT).rows;
  const months = groupAttendance(rows, ["northgate civils ltd"]);

  it("splits own staff from subcontractors by month", () => {
    expect(months.map((m) => m.month)).toEqual(["2026-03", "2026-04"]);
    expect(months[0].own).toEqual({ days: 2, people: 1 });
    expect(months[0].subcontractor).toEqual({ days: 1, people: 1 });
  });

  it("gives no figure until five answers carry a distance", () => {
    const four = [answer("car", 40), answer("car", 20), answer("bus", 10), answer("rail", 60), answer("car", null)];
    expect(surveyDistances(four, "own")).toBeNull();
  });

  it("prices each person's round trip at their own mode, shared vehicles divided", () => {
    const answers = [
      answer("van", 60, 3),
      answer("van", 60, 3),
      answer("van", 60, 3),
      answer("car", 40),
      answer("rail", 100),
      answer("active", 5),
    ];
    const d = surveyDistances(answers, "own")!;
    // Per day on site: three people in one van, 60 km round trip, make 60 van km; plus 40 car km; over 6 answers.
    expect(d.kmPerDay.car).toBeCloseTo((20 + 20 + 20 + 40) / 6);
    expect(d.kmPerDay.rail).toBeCloseTo(100 / 6);
    expect(d.vans).toBe(true);
    expect(d.averageRoundTripKm).toBe(54.2);
    // 30 days on site.
    expect(kmByMode(30, d)).toEqual([
      { mode: "car", km: 500 },
      { mode: "rail", km: 500 },
    ]);
    expect(personKm(30, d)).toBe(1626);
  });

  it("uses own staff's answers when there are enough, else everyone's", () => {
    const subs = Array.from({ length: 5 }, () => answer("car", 200, 1, "subcontractor"));
    const own = Array.from({ length: 5 }, () => answer("rail", 30));
    expect(surveyDistances([...subs, ...own], "own")!.kmPerDay).toEqual({ rail: 30 });
    const mixed = surveyDistances([...subs, answer("rail", 30)], "own")!;
    expect(mixed.used).toBe(6);
    expect(mixed.source).toMatch(/everyone on site/);
  });

  it("keeps aggregates only in the evidence", () => {
    const d = surveyDistances(Array.from({ length: 5 }, (_, i) => answer(i < 3 ? "car" : "bus", 30 + i)), "own")!;
    const csv = commuteEvidenceCsv(months[0], { own: d, subcontractor: null });
    expect(csv).toContain("2026-03,own,2,1,Car,3,31.0,18.60,counted (Category 7)");
    expect(csv).toContain("2026-03,own,2,1,Bus or coach,2,33.5,13.40,counted (Category 7)");
    expect(csv).toContain("subcontractor,1,1,,0,,,no survey distances");
    expect(csv).not.toMatch(/Worker|7AB|101|HD9/);
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
