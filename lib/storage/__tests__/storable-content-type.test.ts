import { describe, expect, test } from "vitest";
import { storableContentType } from "../content-type";

describe("storableContentType", () => {
  test.each([
    ["application/pdf", "application/pdf"],
    ["Application/PDF; name=ticket.pdf", "application/pdf"],
    ["image/png", "image/png"],
    ["text/csv; charset=utf-8", "text/csv"],
  ])("stores %j as %j", (given, stored) => {
    expect(storableContentType(given)).toBe(stored);
  });

  test.each([
    "text/html",
    "text/html; charset=utf-8",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
    "text/javascript",
    "application/javascript",
    "application/ecmascript",
    "text/xsl",
    "application/xslt+xml",
  ])("stores active type %j as a download", (type) => {
    expect(storableContentType(type)).toBe("application/octet-stream");
  });

  test.each(["", "pdf", "text/html/../x", "a b/c", "*/*"])("stores malformed type %j as a download", (type) => {
    expect(storableContentType(type)).toBe("application/octet-stream");
  });
});
