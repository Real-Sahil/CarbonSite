// Bank holidays for the Defra receipt deadline, copied from https://www.gov.uk/bank-holidays.json (Open Government
// Licence v3.0, public sector information). Fetched 12 October 2026. Only 2026 to 2028 are loaded; the deadline function
// refuses any day outside these years rather than guessing. Titles are left out except where a line needs a note.
// Re-copy the file each year; the test in __tests__/deadline.test.ts pins the counts so a dropped line fails there.

export const BANK_HOLIDAY_YEARS = { first: 2026, last: 2028 } as const;

export const BANK_HOLIDAYS = {
  "england-and-wales": [
    "2026-01-01", // New Year's Day
    "2026-04-03", // Good Friday
    "2026-04-06", // Easter Monday
    "2026-05-04", // Early May
    "2026-05-25", // Spring
    "2026-08-31", // Summer
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (substitute)
    "2027-01-01", // New Year's Day
    "2027-03-26", // Good Friday
    "2027-03-29", // Easter Monday
    "2027-05-03", // Early May
    "2027-05-31", // Spring
    "2027-08-30", // Summer
    "2027-12-27", // Christmas Day (substitute)
    "2027-12-28", // Boxing Day (substitute)
    "2028-01-03", // New Year's Day (substitute)
    "2028-04-14", // Good Friday
    "2028-04-17", // Easter Monday
    "2028-05-01", // Early May
    "2028-05-29", // Spring
    "2028-08-28", // Summer
    "2028-12-25", // Christmas Day
    "2028-12-26", // Boxing Day
  ],
  scotland: [
    "2026-01-01", // New Year's Day
    "2026-01-02", // 2nd January
    "2026-04-03", // Good Friday
    "2026-05-04", // Early May
    "2026-05-25", // Spring
    "2026-06-15", // World Cup bank holiday (one-off)
    "2026-08-03", // Summer
    "2026-11-30", // St Andrew's Day
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (substitute)
    "2027-01-01", // New Year's Day
    "2027-01-04", // 2nd January (substitute)
    "2027-03-26", // Good Friday
    "2027-05-03", // Early May
    "2027-05-31", // Spring
    "2027-08-02", // Summer
    "2027-11-30", // St Andrew's Day
    "2027-12-27", // Christmas Day (substitute)
    "2027-12-28", // Boxing Day (substitute)
    "2028-01-03", // New Year's Day (substitute)
    "2028-01-04", // 2nd January (substitute)
    "2028-04-14", // Good Friday
    "2028-05-01", // Early May
    "2028-05-29", // Spring
    "2028-08-07", // Summer
    "2028-11-30", // St Andrew's Day
    "2028-12-25", // Christmas Day
    "2028-12-26", // Boxing Day
  ],
  "northern-ireland": [
    "2026-01-01", // New Year's Day
    "2026-03-17", // St Patrick's Day
    "2026-04-03", // Good Friday
    "2026-04-06", // Easter Monday
    "2026-05-04", // Early May
    "2026-05-25", // Spring
    "2026-07-13", // Battle of the Boyne (substitute)
    "2026-08-31", // Summer
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (substitute)
    "2027-01-01", // New Year's Day
    "2027-03-17", // St Patrick's Day
    "2027-03-26", // Good Friday
    "2027-03-29", // Easter Monday
    "2027-05-03", // Early May
    "2027-05-31", // Spring
    "2027-07-12", // Battle of the Boyne
    "2027-08-30", // Summer
    "2027-12-27", // Christmas Day (substitute)
    "2027-12-28", // Boxing Day (substitute)
    "2028-01-03", // New Year's Day (substitute)
    "2028-03-17", // St Patrick's Day
    "2028-04-14", // Good Friday
    "2028-04-17", // Easter Monday
    "2028-05-01", // Early May
    "2028-05-29", // Spring
    "2028-07-12", // Battle of the Boyne
    "2028-08-28", // Summer
    "2028-12-25", // Christmas Day
    "2028-12-26", // Boxing Day
  ],
} as const;

export type Nation = keyof typeof BANK_HOLIDAYS;
