import { describe, expect, it } from "vitest";
import { hasArabic, withArabicSupport } from "../arabic";

describe("withArabicSupport", () => {
  it("leaves English-only HTML untouched, so no font weight is added", () => {
    const html = "<html><head></head><body>Acme Ltd</body></html>";
    expect(hasArabic(html)).toBe(false);
    expect(withArabicSupport(html)).toBe(html);
  });
  it("embeds the font for Arabic code points only, inside the head", () => {
    const html = "<html><head><title>x</title></head><body>شركة الإمارات للإنشاءات</body></html>";
    const out = withArabicSupport(html);
    expect(out).toContain("font/woff2;base64,");
    expect(out).toContain("unicode-range:U+0600-06FF");
    expect(out.indexOf('id="arabic-support"')).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain("شركة الإمارات للإنشاءات");
  });
  it("adds the style at the start when there is no head", () => {
    expect(withArabicSupport("<p>مرحبا</p>").startsWith('<style id="arabic-support">')).toBe(true);
  });
});
