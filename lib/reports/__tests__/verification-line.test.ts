// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { addVerificationLine } from "../pdf-generator";
import { parseSections } from "@/lib/crp/plan";

describe("verification line", () => {
  it("is off unless the plan opts in", () => {
    expect(parseSections({}).organisation.showVerificationLine).toBe(false);
    expect(parseSections({ organisation: { showVerificationLine: true } }).organisation.showVerificationLine).toBe(true);
  });

  it("adds one link to the verification page on the last page only", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    const url = "https://www.metricora.co.uk/public/reports/verify/abc123";
    const out = await PDFDocument.load(await addVerificationLine(Buffer.from(await doc.save()), url));
    const [first, last] = out.getPages();
    expect(first.node.Annots()).toBeUndefined();
    const annots = last.node.Annots()!;
    expect(annots.size()).toBe(1);
    const link = out.context.lookup(annots.get(0)) as unknown as { get(n: PDFName): unknown };
    const action = out.context.lookup(link.get(PDFName.of("A")) as never) as unknown as { get(n: PDFName): { decodeText(): string } };
    expect(action.get(PDFName.of("URI")).decodeText()).toBe(url);
  });
});
