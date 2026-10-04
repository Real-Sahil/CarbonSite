import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ llmClient: llm }));

import { changeSummary, explainWithAi } from "../change";
import { draftNarrative, factsText } from "../draft-narrative";
import { buildWaterfall } from "@/lib/charts/waterfall";

const steps = buildWaterfall(
  [{ id: "a", label: "Mobile combustion", kg: 50000 }, { id: "b", label: "Electricity", kg: 30000 }, { id: "c", label: "Waste", kg: 1000 }],
  [{ id: "a", label: "Mobile combustion", kg: 39200 }, { id: "b", label: "Electricity", kg: 31000 }, { id: "c", label: "Waste", kg: 1000 }],
  { previous: "FY2024", current: "FY2025" },
);

beforeEach(() => llm.complete.mockReset());

describe("changeSummary", () => {
  it("states the move, its size and the biggest changes, from the steps alone", () => {
    const s = changeSummary(steps)!;
    expect(s.direction).toBe("down");
    expect(s.sentences[0]).toBe("Emissions fell from 81.0 tCO2e in FY2024 to 71.2 tCO2e in FY2025, a fall of 9.8 tCO2e (12.1%).");
    expect(s.sentences).toContain("Mobile combustion fell by 10.8 tCO2e.");
    expect(s.sentences).toContain("Electricity rose by 1.0 tCO2e.");
  });

  it("says so when nothing moved and returns null without totals", () => {
    const flat = buildWaterfall([{ id: "a", label: "A", kg: 5000 }], [{ id: "a", label: "A", kg: 5000 }], { previous: "P", current: "C" });
    expect(changeSummary(flat)!.sentences[0]).toContain("unchanged");
    expect(changeSummary([])).toBeNull();
  });
});

describe("explainWithAi", () => {
  const facts = changeSummary(steps)!.facts;

  it("uses a paragraph whose figures are all in the facts", async () => {
    llm.complete.mockResolvedValue({ text: "Emissions fell by 9.8 tCO2e, mostly from mobile combustion at 10.8 tCO2e lower.", tokens: 10, provider: "groq" });
    expect(await explainWithAi(facts)).toEqual({ text: expect.stringContaining("9.8"), provider: "groq" });
  });

  it("refuses a paragraph that states a figure we did not supply", async () => {
    llm.complete.mockResolvedValue({ text: "Emissions fell 40% thanks to the new fleet.", tokens: 10, provider: "groq" });
    const r = await explainWithAi(facts);
    expect("rejected" in r && r.rejected).toContain("40");
  });
});

describe("draftNarrative", () => {
  const facts = { label: "FY2025", totalKg: 71200, scopes: [{ scope: 1, kg: 40000 }, { scope: 2, kg: 31200 }], categories: [{ name: "Mobile combustion", kg: 39200 }] };
  const reply = (summary: string) => ({ text: `EXECUTIVE_SUMMARY:\n${summary}\n\nKEY_FINDINGS:\n- Mobile combustion is the largest source.\n\nRECOMMENDATIONS:\nAttach bills to every record.`, tokens: 1, provider: "groq" });

  it("builds the prompt from the figures only", () => {
    expect(factsText(facts)).toContain("Total emissions: 71.20 tCO2e");
    expect(factsText(facts)).toContain("Scope 1: 40.00 tCO2e (56.2%)");
  });

  it("returns a grounded draft", async () => {
    llm.complete.mockResolvedValue(reply("Total emissions were 71.20 tCO2e in FY2025."));
    const d = await draftNarrative(facts);
    expect("executiveSummary" in d && d.keyFindings).toEqual(["Mobile combustion is the largest source."]);
  });

  it("refuses a draft with an invented figure", async () => {
    llm.complete.mockResolvedValue(reply("Emissions of 250.00 tCO2e were recorded."));
    const d = await draftNarrative(facts);
    expect("rejected" in d && d.rejected).toContain("250.00");
  });

  it("refuses an unusable reply", async () => {
    llm.complete.mockResolvedValue({ text: "Sorry, I cannot.", tokens: 1, provider: "groq" });
    expect("rejected" in (await draftNarrative(facts))).toBe(true);
  });
});
