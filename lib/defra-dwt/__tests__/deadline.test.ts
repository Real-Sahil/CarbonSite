import { describe, expect, it } from "vitest";
import { BANK_HOLIDAY_YEARS, BANK_HOLIDAYS, type Nation } from "../bank-holidays";
import { submissionDeadline, type WindowStart, windowStartDay } from "../receipt";
import { assertDay, endOfUkDay, isWorkingDay, nthWorkingDayAfter, ukDay } from "../working-days";

const NATIONS: Nation[] = ["england-and-wales", "scotland", "northern-ireland"];

const receipt = (iso: string): WindowStart => ({ kind: "receipt", received: new Date(iso) });
const due = (start: WindowStart, nation: Nation = "england-and-wales") => submissionDeadline(start, nation).toISOString();

const isWeekday = (day: string) => {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
};

describe("bank holiday data", () => {
  // Counts pin the copy from gov.uk: a dropped or doubled line fails here before it moves a deadline.
  it("loads the expected number of bank holidays per nation and year", () => {
    const expected: Record<Nation, number[]> = {
      "england-and-wales": [8, 8, 8],
      scotland: [10, 9, 9],
      "northern-ireland": [10, 10, 10],
    };
    for (const nation of NATIONS) {
      const counts = [2026, 2027, 2028].map((year) => BANK_HOLIDAYS[nation].filter((day) => day.startsWith(`${year}-`)).length);
      expect(counts, nation).toEqual(expected[nation]);
    }
  });

  it("lists each holiday once, in order, as a real weekday inside the loaded years", () => {
    for (const nation of NATIONS) {
      const days = [...BANK_HOLIDAYS[nation]];
      expect(new Set(days).size, nation).toBe(days.length);
      expect(days.slice().sort(), nation).toEqual(days);
      for (const day of days) {
        assertDay(day);
        expect(isWeekday(day), day).toBe(true);
        const year = Number(day.slice(0, 4));
        expect(year, day).toBeGreaterThanOrEqual(BANK_HOLIDAY_YEARS.first);
        expect(year, day).toBeLessThanOrEqual(BANK_HOLIDAY_YEARS.last);
      }
    }
  });
});

describe("working days", () => {
  it("treats weekends and that nation's bank holidays as non-working days", () => {
    expect(isWorkingDay("2026-10-10", "england-and-wales")).toBe(false); // Saturday
    expect(isWorkingDay("2026-12-25", "england-and-wales")).toBe(false);
    expect(isWorkingDay("2026-06-15", "scotland")).toBe(false); // one-off World Cup holiday
    expect(isWorkingDay("2026-07-13", "northern-ireland")).toBe(false); // Battle of the Boyne, substitute
    expect(isWorkingDay("2026-07-13", "england-and-wales")).toBe(true);
    expect(isWorkingDay("2026-08-03", "england-and-wales")).toBe(true);
    expect(isWorkingDay("2026-08-03", "scotland")).toBe(false);
  });

  it("refuses a day outside the loaded bank-holiday years rather than guessing", () => {
    expect(() => isWorkingDay("2025-12-31", "scotland")).toThrow(RangeError);
    expect(() => isWorkingDay("2029-01-02", "scotland")).toThrow(RangeError);
  });

  it("rejects text that is not a real calendar day written YYYY-MM-DD", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "05/10/2026", "2026-10-5", "2026-10-05T00:00"]) {
      expect(() => assertDay(bad), bad).toThrow(RangeError);
    }
    expect(() => assertDay("2028-02-29")).not.toThrow();
  });

  it("counts from the day after, skipping a bank holiday that falls inside the count", () => {
    // Thursday 27 August 2026: Friday 28 is day 1, Monday 31 is a holiday in England and Wales, Tuesday 1 September is day 2.
    expect(nthWorkingDayAfter("2026-08-27", 2, "england-and-wales")).toBe("2026-09-01");
    // Scotland has no holiday on 31 August, so Monday is day 2.
    expect(nthWorkingDayAfter("2026-08-27", 2, "scotland")).toBe("2026-08-31");
  });

  it("reads the day in London, not in UTC", () => {
    expect(ukDay(new Date("2026-10-05T23:30:00Z"))).toBe("2026-10-06"); // 00:30 BST on the 6th
    expect(ukDay(new Date("2026-10-05T22:30:00Z"))).toBe("2026-10-05"); // 23:30 BST on the 5th
    expect(ukDay(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15"); // GMT, same as UTC
  });

  it("ends a UK day at 23:59:59.999 local time, across both clock changes", () => {
    expect(endOfUkDay("2026-03-28").toISOString()).toBe("2026-03-28T23:59:59.999Z"); // GMT
    expect(endOfUkDay("2026-03-29").toISOString()).toBe("2026-03-29T22:59:59.999Z"); // BST starts this night
    expect(endOfUkDay("2026-10-24").toISOString()).toBe("2026-10-24T22:59:59.999Z"); // BST
    expect(endOfUkDay("2026-10-25").toISOString()).toBe("2026-10-25T23:59:59.999Z"); // GMT from this night
  });
});

describe("submissionDeadline", () => {
  it("gives a Monday receipt until Wednesday, and a Friday receipt until Tuesday", () => {
    expect(due(receipt("2026-10-05T09:00:00Z"))).toBe("2026-10-07T22:59:59.999Z");
    expect(due(receipt("2026-10-09T16:00:00Z"))).toBe("2026-10-13T22:59:59.999Z");
  });

  it("gives the same deadline for a Saturday receipt as for the Friday before it", () => {
    expect(due(receipt("2026-10-10T10:00:00Z"))).toBe("2026-10-13T22:59:59.999Z");
  });

  it("counts a UK day, not a UTC day: 00:30 BST on Tuesday is a Tuesday receipt", () => {
    // 23:30 UTC on Monday is 00:30 on Tuesday in London, so the window is Wednesday and Thursday.
    expect(due(receipt("2026-10-05T23:30:00Z"))).toBe("2026-10-08T22:59:59.999Z");
    // An hour earlier it is still Monday in London, so the window is Tuesday and Wednesday.
    expect(due(receipt("2026-10-05T22:30:00Z"))).toBe("2026-10-07T22:59:59.999Z");
  });

  it("pushes the deadline past an English bank holiday", () => {
    // Thursday 27 August 2026: Monday 31 August is the Summer bank holiday in England and Wales.
    expect(due(receipt("2026-08-27T09:00:00Z"))).toBe("2026-09-01T22:59:59.999Z");
  });

  it("gives a different deadline for the same receipt in each nation", () => {
    // Thursday 30 July 2026: Monday 3 August is a holiday in Scotland, not in England and Wales.
    const thirtyJuly = receipt("2026-07-30T09:00:00Z");
    expect(due(thirtyJuly, "england-and-wales")).toBe("2026-08-03T22:59:59.999Z");
    expect(due(thirtyJuly, "scotland")).toBe("2026-08-04T22:59:59.999Z");
  });

  it("moves the deadline for the Northern Ireland holiday on 13 July 2026", () => {
    // Thursday 9 July 2026: Friday 10 is day 1. Monday 13 is a holiday only in Northern Ireland.
    const ninth = receipt("2026-07-09T09:00:00Z");
    expect(due(ninth, "england-and-wales")).toBe("2026-07-13T22:59:59.999Z");
    expect(due(ninth, "northern-ireland")).toBe("2026-07-14T22:59:59.999Z");
  });

  it("skips the Christmas and Boxing Day substitutes, and is in GMT in winter", () => {
    // Thursday 24 December 2026: Friday 25 and Monday 28 are holidays, so Tuesday 29 and Wednesday 30 are the window.
    expect(due(receipt("2026-12-24T10:00:00Z"))).toBe("2026-12-30T23:59:59.999Z");
  });

  it("counts piped waste from the last load day", () => {
    expect(due({ kind: "piped-last-load", lastLoad: "2026-10-09" })).toBe("2026-10-13T22:59:59.999Z");
  });

  it("opens continuous piping from the earlier of the quarter end and the day piping stops", () => {
    // Piping stops on Wednesday 7 October, before the quarter end: window from the 7th, due Friday 9th.
    expect(due({ kind: "piped-continuous", quarterEnd: "2026-12-31", pipingStops: "2026-10-07" })).toBe("2026-10-09T22:59:59.999Z");
    // Quarter end is Friday 2 October, before piping stops: window from the 2nd, due Tuesday 6th.
    expect(due({ kind: "piped-continuous", quarterEnd: "2026-10-02", pipingStops: "2026-10-20" })).toBe("2026-10-06T22:59:59.999Z");
    expect(due({ kind: "piped-continuous", quarterEnd: "2026-10-02" })).toBe("2026-10-06T22:59:59.999Z");
  });

  it("refuses a window start that is not a real calendar day", () => {
    expect(() => windowStartDay({ kind: "piped-last-load", lastLoad: "2026-02-30" })).toThrow(RangeError);
    expect(() => windowStartDay({ kind: "piped-continuous", quarterEnd: "2026-10-02", pipingStops: "02/10/2026" })).toThrow(RangeError);
  });

  it("refuses a receipt whose window runs into a year with no bank holidays loaded", () => {
    expect(() => due(receipt("2029-06-01T09:00:00Z"))).toThrow(RangeError);
  });
});
