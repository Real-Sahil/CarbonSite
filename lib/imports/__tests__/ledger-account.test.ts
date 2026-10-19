import { describe, expect, it } from "vitest";
import { detectActivityColumnMapping } from "../column-mapper";

describe("ledger account column", () => {
  it("maps common ledger and nominal headers to ledgerAccount", () => {
    for (const header of ["GL Account", "Nominal Code", "ledger-code"]) {
      const result = detectActivityColumnMapping([header]);
      expect(result.mapped).toEqual([
        expect.objectContaining({ sourceHeader: header, canonicalField: "ledgerAccount" }),
      ]);
    }
  });

  it("leaves a bare Account header unmapped, since bank files use it for other things", () => {
    const result = detectActivityColumnMapping(["Account"]);
    expect(result.mapped).toEqual([]);
    expect(result.unmapped).toEqual(["Account"]);
  });
});
