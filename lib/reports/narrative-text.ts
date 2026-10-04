// Tiptap documents to the plain text a report prints, and back. Reports print
// plain text only (escaped), so the editor is limited to paragraphs and a
// bullet list and nothing else can reach a report.

type Node = { type?: string; text?: string; content?: Node[] };

const textOf = (n: Node): string =>
  n.type === "hardBreak" ? "\n" : n.text ?? (n.content ?? []).map(textOf).join("");

/** Paragraphs separated by a blank line; empty paragraphs dropped. */
export function docToParagraphs(doc: Node): string {
  return (doc.content ?? [])
    .filter((n) => n.type === "paragraph")
    .map(textOf)
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** One entry per bullet (or per paragraph when no list is used). */
export function docToBullets(doc: Node): string[] {
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    if (n.type === "bulletList") for (const li of n.content ?? []) out.push((li.content ?? []).map(textOf).join(" ").trim());
    else if (n.type === "paragraph") out.push(textOf(n).trim());
  }
  return out.filter(Boolean);
}

export const paragraphsToDoc = (text: string): Node => ({
  type: "doc",
  content: text.split(/\n{2,}|\n/).map((t) => t.trim()).filter(Boolean).map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
});

export const bulletsToDoc = (items: string[]): Node => ({
  type: "doc",
  content: items.length
    ? [{ type: "bulletList", content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })) }]
    : [{ type: "paragraph" }],
});
