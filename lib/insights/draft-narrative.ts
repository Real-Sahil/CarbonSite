// A grounded first draft of the summary page of an inventory report, for a
// person to review, edit and save. Figures come from the data we pass in; text
// that states a figure outside it is refused, never edited.

import { llmClient } from "@/lib/llm/client";
import { ungroundedNumbers } from "@/lib/llm/grounding";
import { parseNarrativeResponse } from "@/lib/reports/narrative-generator";

export type PeriodFacts = {
  label: string;
  totalKg: number;
  scopes: { scope: number; kg: number }[];
  categories: { name: string; kg: number }[];
};

const t = (kg: number) => (kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0");

export function factsText(f: PeriodFacts): string {
  return [
    `Reporting period: ${f.label}`,
    `Total emissions: ${t(f.totalKg)} tCO2e`,
    ...f.scopes.map((s) => `Scope ${s.scope}: ${t(s.kg)} tCO2e (${pct(s.kg, f.totalKg)}%)`),
    ...f.categories.map((c) => `${c.name}: ${t(c.kg)} tCO2e (${pct(c.kg, f.totalKg)}%)`),
  ].join("\n");
}

export type DraftResult =
  | { executiveSummary: string; keyFindings: string[]; recommendations: string }
  | { rejected: string };

export async function draftNarrative(f: PeriodFacts): Promise<DraftResult> {
  const facts = factsText(f);
  const prompt = `You are a sustainability reporting analyst. Write a first draft of the summary page of a carbon emissions report for a person to review. Use only the facts below: no other numbers, no causes you cannot see, no targets or promises.\n\n${facts}\n\nStructure your response exactly as:\n\nEXECUTIVE_SUMMARY:\n[two short paragraphs]\n\nKEY_FINDINGS:\n[three or four bullet lines starting with "- "]\n\nRECOMMENDATIONS:\n[one short paragraph of reporting and data-quality suggestions]`;
  const result = await llmClient.complete(prompt, { maxTokens: 700, temperature: 0.3, timeoutMs: 20_000 });
  // The parser falls back to the whole reply as a summary; a draft must have followed the structure.
  if (!/EXECUTIVE_SUMMARY:/.test(result.text)) return { rejected: "The model did not return a usable draft." };
  const n = parseNarrativeResponse(result.text);
  const body = [n.executive_summary, ...n.key_findings, n.recommendations].join("\n");
  if (!n.executive_summary) return { rejected: "The model did not return a usable draft." };
  const invented = ungroundedNumbers(body, facts);
  if (invented.length > 0) return { rejected: `The draft stated figures that are not in the data (${invented.slice(0, 3).join(", ")}), so it was not used.` };
  return { executiveSummary: n.executive_summary, keyFindings: n.key_findings, recommendations: n.recommendations };
}
