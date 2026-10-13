import { describe, expect, test } from "vitest";
import { serveDisposition } from "../serve-disposition";

describe("serveDisposition", () => {
  test.each([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "IMAGE/PNG; charset=binary",
  ])("shows %j inline", (type) => {
    expect(serveDisposition(type, "ticket.pdf")).toBe('inline; filename="ticket.pdf"');
  });

  test.each([
    "text/html",
    "image/svg+xml",
    "application/xhtml+xml",
    "text/csv",
    "application/octet-stream",
    "",
  ])("downloads %j as an attachment", (type) => {
    expect(serveDisposition(type, "file.bin")).toBe('attachment; filename="file.bin"');
  });

  test("drops double quotes from the filename", () => {
    expect(serveDisposition("application/pdf", 'a"b.pdf')).toBe('inline; filename="ab.pdf"');
  });
});
