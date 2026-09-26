/**
 * Keeps model-written wording honest: every number in generated text must
 * be one of the figures we gave the model (at any rounding), so a narrative
 * can never introduce a figure the report does not contain. Anything else
 * is rejected and the caller falls back to wording without the model.
 */

const NUMBER = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

type Num = { raw: string; value: number; decimals: number; percent: boolean };

function numbersIn(text: string): Num[] {
  const cleaned = text
    // Labels, not quantities: "Scope 1", "s3-waste", "E1-6", "Category 7", list markers.
    .replace(/\bscope\s*[123]\b/gi, " ")
    .replace(/\b[se][0-9]+-[a-z0-9-]+/gi, " ")
    .replace(/\bcategor(?:y|ies)\s*\d+(?:\s*(?:and|,|-|to)\s*\d+)*/gi, " ")
    .replace(/^\s*\d+[.)]\s/gm, " ");
  const out: Num[] = [];
  for (const m of cleaned.matchAll(NUMBER)) {
    const raw = m[0];
    const plain = raw.replace(/,/g, "");
    const after = cleaned.slice((m.index ?? 0) + raw.length, (m.index ?? 0) + raw.length + 2);
    out.push({
      raw,
      value: Number(plain),
      decimals: plain.includes(".") ? plain.split(".")[1].length : 0,
      percent: /^\s?%/.test(after),
    });
  }
  return out;
}

/** Numbers in `text` that no figure in `facts` rounds to. Empty means grounded. */
export function ungroundedNumbers(text: string, facts: string): string[] {
  const known = numbersIn(facts).map((n) => n.value);
  const bad: string[] = [];
  for (const n of numbersIn(text)) {
    // Small whole counts ("three findings", "2 sites") are wording, unless a percentage.
    if (!n.percent && n.decimals === 0 && Math.abs(n.value) <= 10) continue;
    const tolerance = 0.5 * 10 ** -n.decimals + 1e-9;
    if (!known.some((k) => Math.abs(k - n.value) <= tolerance)) bad.push(n.raw);
  }
  return [...new Set(bad)];
}
