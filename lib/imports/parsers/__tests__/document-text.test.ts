// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { documentText, DocumentReadError } from "../pdf";

async function pdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((t, i) => page.drawText(t, { x: 50, y: 780 - i * 20, size: 12, font }));
  return Buffer.from(await doc.save());
}

describe("documentText", () => {
  it("reads a PDF's text layer", async () => {
    const r = await documentText(await pdf(["EDF Energy business electricity bill", "Total units used: 1,850 kWh"]), "application/pdf");
    expect(r.method).toBe("pdf-text");
    expect(r.text).toContain("1,850 kWh");
  }, 30_000);

  it("refuses a PDF with no text layer instead of sending it to OCR", async () => {
    await expect(documentText(await pdf([]), "application/pdf")).rejects.toMatchObject({ code: "SCANNED_PDF" });
  }, 30_000);

  it("refuses a PDF it cannot open", async () => {
    const err = await documentText(Buffer.from("not a pdf"), "application/pdf").catch((e) => e);
    expect(err).toBeInstanceOf(DocumentReadError);
    expect(err.code).toBe("UNREADABLE");
  }, 30_000);
});
