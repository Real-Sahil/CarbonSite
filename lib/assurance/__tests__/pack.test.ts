import { describe, expect, it } from "vitest";
import { csvCell, csvLine, zipSafeName } from "../pack";

describe("pack CSV cells", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('EDF, "Business"')).toBe('"EDF, ""Business"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell(-3)).toBe("-3");
  });

  it("writes dates, decimals, objects and nulls", () => {
    expect(csvCell(new Date("2025-06-30T00:00:00Z"))).toBe("2025-06-30T00:00:00.000Z");
    expect(csvCell({ toFixed: () => "", toString: () => "39828.4" })).toBe("39828.4");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvLine([null, undefined, 0])).toBe(",,0\n");
  });
});

describe("zipSafeName", () => {
  it("drops paths and odd characters", () => {
    expect(zipSafeName("../../etc/passwd")).toBe("passwd");
    expect(zipSafeName("C:\\bills\\EDF Q2 (final).pdf")).toBe("EDF Q2 (final).pdf");
    expect(zipSafeName("bill\u0000.pdf")).toBe("bill_.pdf");
  });
});
