// "Explain this change": what moved between two periods, in words. The plain
// summary is computed from the waterfall steps and needs no model. When the
// organisation has AI assistance on, a model may rewrite the same facts as a
// short paragraph, and the text is used only if every figure in it is one of
// the facts we gave it (lib/llm/grounding).

import { llmClient } from "@/lib/llm/client";
import { ungroundedNumbers } from "@/lib/llm/grounding";
import type { WaterfallStep } from "@/lib/charts/waterfall";

const t = (kg: number, locale: string) => (kg / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type ChangeSummary = { sentences: string[]; facts: string; direction: "up" | "down" | "flat" };

export function changeSummary(steps: WaterfallStep[], locale = "en-GB"): ChangeSummary | null {
  const start = steps.find((s) => s.id === "start");
  const end = steps.find((s) => s.id === "end");
  if (!start || !end) return null;
  const delta = end.value - start.value;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const pct = start.value > 0 ? Math.abs(delta / start.value) * 100 : null;
  const sentences: string[] = [
    direction === "flat"
      ? `Emissions were unchanged at ${t(end.value, locale)} tCO2e between ${start.label} and ${end.label}.`
      : `Emissions ${direction === "down" ? "fell" : "rose"} from ${t(start.value, locale)} tCO2e in ${start.label} to ${t(end.value, locale)} tCO2e in ${end.label}, a ${direction === "down" ? "fall" : "rise"} of ${t(Math.abs(delta), locale)} tCO2e${pct != null ? ` (${pct.toLocaleString(locale, { maximumFractionDigits: 1 })}%)` : ""}.`,
  ];
  const changes = steps.filter((s) => s.kind === "change");
  for (const c of changes.slice(0, 3)) {
    sentences.push(`${c.label} ${c.value < 0 ? "fell" : "rose"} by ${t(Math.abs(c.value), locale)} tCO2e.`);
  }
  const rest = changes.slice(3);
  if (rest.length > 0) sentences.push(`All other categories together ${rest.reduce((s, c) => s + c.value, 0) < 0 ? "fell" : "rose"} by ${t(Math.abs(rest.reduce((s, c) => s + c.value, 0)), locale)} tCO2e.`);
  return { sentences, facts: sentences.join("\n"), direction };
}

export type ExplainResult = { text: string; provider: string } | { rejected: string };

/** A model's paragraph for the facts, or why it was not used. Callers check the organisation turned AI assistance on. */
export async function explainWithAi(facts: string): Promise<ExplainResult> {
  const prompt = `You are a sustainability analyst. Explain in one short paragraph (three or four sentences, plain UK English) what changed in an organisation's greenhouse gas emissions between two periods. Use only the facts below. Do not add any other numbers, causes or predictions; if you do not know why something changed, do not say.\n\nFacts:\n${facts}`;
  const result = await llmClient.complete(prompt, { maxTokens: 300, temperature: 0.2, timeoutMs: 15_000 });
  const invented = ungroundedNumbers(result.text, facts);
  if (invented.length > 0) return { rejected: `The wording stated figures that are not in the data (${invented.slice(0, 3).join(", ")}), so it was left out.` };
  if (!result.text) return { rejected: "The model returned nothing." };
  return { text: result.text, provider: result.provider };
}
