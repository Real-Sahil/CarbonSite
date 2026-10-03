// Arabic in report PDFs. The server's Chromium has no Arabic system font, so an
// Arabic organisation, facility or supplier name would print as empty boxes.
// When a report's HTML contains Arabic, embed Noto Naskh Arabic for the Arabic
// code points only (Latin text keeps the template's own fonts) and let each
// block take its direction from its own first strong character, so an Arabic
// name inside an English sentence or table cell reads right to left.

import { NASKH_400_WOFF2_BASE64, NASKH_700_WOFF2_BASE64 } from "./arabic-font-data";

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const RANGE = "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F";
// The families the report templates name first; declaring them with an Arabic-only range adds Arabic without replacing Latin.
const FAMILIES = ["Helvetica Neue", "Arial", "Helvetica", "Segoe UI"];

export const hasArabic = (html: string) => ARABIC.test(html);

function css(): string {
  const face = (family: string, weight: number, data: string) =>
    `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${RANGE};}`;
  return (
    FAMILIES.flatMap((f) => [face(f, 400, NASKH_400_WOFF2_BASE64), face(f, 700, NASKH_700_WOFF2_BASE64)]).join("") +
    "p,td,th,li,h1,h2,h3,h4,div,span{unicode-bidi:plaintext;}"
  );
}

/** The HTML with Arabic support added when it contains Arabic; otherwise unchanged. */
export function withArabicSupport(html: string): string {
  if (!hasArabic(html)) return html;
  const style = `<style id="arabic-support">${css()}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : style + html;
}
