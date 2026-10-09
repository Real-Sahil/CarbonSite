import { describe, expect, it } from "vitest";
import corpus from "./fixtures/transfer-note-corpus.json";
import { extractTransferNote } from "../transfer-note-extractor";
import { carrierDefaults, triageDocument } from "../triage";

/**
 * 106 synthetic transfer notes in the layouts UK carriers use (paragraph, table, weighbridge ticket, hazardous
 * consignment, letterhead, form grid, docket), read from real rendered PDFs; scripts/waste-corpus/run.mts rebuilds
 * the fixture. The test holds the two things that matter most: the reader never returns a wrong value, and a
 * document that is not a transfer note can never be marked ready. A missing value is allowed, a wrong one is not.
 */
type Doc = { set: string; id: string; layout: string; text: string; truth: Record<string, string | number | null> };
const DOCS = corpus as Doc[];
const FIELDS = ["reference", "carrierRegistration", "ewc", "tonnes", "date", "vehicle"] as const;
const notes = DOCS.filter((d) => d.layout !== "not-a-note");
const nonNotes = DOCS.filter((d) => d.layout === "not-a-note");

describe("transfer-note reader on the corpus", () => {
  it("never returns a wrong value", () => {
    const wrong: string[] = [];
    for (const d of notes) {
      const got = extractTransferNote(d.text) as Record<string, unknown>;
      for (const f of FIELDS) {
        if (got[f] !== undefined && String(got[f]) !== String(d.truth[f])) wrong.push(`${d.id} ${f}: ${JSON.stringify(got[f])} vs ${JSON.stringify(d.truth[f])}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("finds every field on at least 99% of notes", () => {
    let right = 0, total = 0;
    for (const d of notes) {
      const got = extractTransferNote(d.text) as Record<string, unknown>;
      for (const f of FIELDS) { total++; if (String(got[f]) === String(d.truth[f])) right++; }
    }
    expect(right / total).toBeGreaterThanOrEqual(0.99);
  });

  it("reads the carrier name correctly whenever it reads one, and none from a 'Collected by' line", () => {
    for (const d of notes) {
      const c = extractTransferNote(d.text).carrier;
      if (d.truth.carrier === null) expect(c, d.id).toBeUndefined();
      else if (c !== undefined) expect(c.toLowerCase(), d.id).toContain(String(d.truth.carrier).toLowerCase().split(" ")[0]);
    }
  });

  it("has no waste code or carrier registration on a document that is not a transfer note", () => {
    expect(nonNotes.length).toBeGreaterThan(0);
    for (const d of nonNotes) {
      const r = extractTransferNote(d.text);
      expect(r.ewc, d.id).toBeUndefined();
      expect(r.carrierRegistration, d.id).toBeUndefined();
    }
  });

  it("can never be marked ready when the document is not a transfer note", () => {
    const history = carrierDefaults([], { registration: "CBDU111111" }, "17 09 04");
    for (const d of nonNotes) {
      const t = triageDocument({
        doc: { kind: "transfer_note", wasteRecordId: null, reference: null, issuer: null, projectId: null, extracted: { ...extractTransferNote(d.text), registerCheck: { status: "registered" } } as never },
        defaults: history,
        periodId: "p1",
        duplicateReference: false,
      });
      expect(t.state, d.id).toBe("review");
      expect(t.reasons.join(" "), d.id).toContain("Does not look like a waste transfer note");
    }
  });
});
