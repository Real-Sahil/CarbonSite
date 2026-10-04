import { describe, expect, it } from "vitest";
import { bulletsToDoc, docToBullets, docToParagraphs, paragraphsToDoc } from "../narrative-text";

describe("narrative text", () => {
  it("round-trips paragraphs with a blank line between them", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    expect(docToParagraphs(paragraphsToDoc(text))).toBe(text);
  });

  it("drops empty paragraphs and keeps line breaks inside one", () => {
    expect(docToParagraphs({ type: "doc", content: [{ type: "paragraph" }, { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] }] })).toBe("a\nb");
  });

  it("round-trips bullets, and reads plain paragraphs as entries when no list is used", () => {
    expect(docToBullets(bulletsToDoc(["One", "Two"]))).toEqual(["One", "Two"]);
    expect(docToBullets(bulletsToDoc([]))).toEqual([]);
    expect(docToBullets(paragraphsToDoc("Only\n\nParagraphs"))).toEqual(["Only", "Paragraphs"]);
  });

  it("ignores any node that is not a paragraph or a list, so nothing else can reach a report", () => {
    const doc = { type: "doc", content: [{ type: "heading", content: [{ type: "text", text: "H" }] }, { type: "paragraph", content: [{ type: "text", text: "kept" }] }, { type: "codeBlock", content: [{ type: "text", text: "x" }] }] };
    expect(docToParagraphs(doc)).toBe("kept");
  });
});
