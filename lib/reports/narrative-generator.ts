import { llmClient } from "@/lib/llm/client";
import { reportLogger } from "@/lib/logger";
import type { ReportData } from "./template";

export interface AuditNarrative {
  executive_summary: string;
  key_findings: string[];
  recommendations: string;
}

function tonnes(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0.0";
  return ((part / whole) * 100).toFixed(1);
}

export async function generateAuditNarrative(reportData: ReportData): Promise<AuditNarrative> {
  if (!llmClient.isConfigured()) {
    reportLogger.warn("LLM not configured - skipping narrative generation", {
      reason: "Set HUGGINGFACE_TOKEN or NVIDIA_NIM_API_KEY in environment"
    });
    return {
      executive_summary:
        "Unable to generate automated narrative — no LLM provider configured. Set HUGGINGFACE_TOKEN or NVIDIA_NIM_API_KEY in your .env file, then regenerate the report.",
      key_findings: [],
      recommendations: "",
    };
  }

  try {
    reportLogger.info("Starting audit narrative generation", {
      orgName: reportData.orgName,
      periodLabel: reportData.periodLabel,
      recordCount: reportData.recordCount,
    });

    const totalTonnes = tonnes(reportData.grandTotalKg);
    const scope1 = reportData.scopes.find((s) => s.scope === 1);
    const scope2 = reportData.scopes.find((s) => s.scope === 2);
    const scope3 = reportData.scopes.find((s) => s.scope === 3);

    const topCategories = reportData.categories.slice(0, 5);
    const categoryList = topCategories
      .map((c) => `${c.name}: ${tonnes(c.totalKg)} tCO2e (${pct(c.totalKg, reportData.grandTotalKg)}%)`)
      .join("\n    - ");

    const prompt = `You are a sustainability reporting analyst. Generate a professional 3-4 paragraph audit narrative for a carbon emissions report.

Organization: ${reportData.orgName}
Reporting Period: ${reportData.periodLabel}
Snapshot Version: ${reportData.snapshotVersion}
Report Type: ${reportData.reportType}

Emissions Summary:
- Total Gross Emissions: ${totalTonnes} tCO2e
- Records Analyzed: ${reportData.recordCount}
- Methodology: ${reportData.methodology}
- Emission Factors: ${reportData.factorLibrary}

Scope Breakdown:
- Scope 1 (Direct): ${scope1 ? tonnes(scope1.totalKg) + " tCO2e (" + pct(scope1.totalKg, reportData.grandTotalKg) + "%)" : "No data"}
- Scope 2 (Purchased Energy): ${scope2 ? tonnes(scope2.totalKg) + " tCO2e (" + pct(scope2.totalKg, reportData.grandTotalKg) + "%)" : "No data"}
- Scope 3 (Value Chain): ${scope3 ? tonnes(scope3.totalKg) + " tCO2e (" + pct(scope3.totalKg, reportData.grandTotalKg) + "%)" : "No data"}

Top Emission Sources:
    - ${categoryList}

Write a professional audit narrative suitable for board-level review. Structure your response as follows:

EXECUTIVE_SUMMARY:
[2-3 paragraph professional summary of emissions profile, key drivers, and data quality]

KEY_FINDINGS:
[List 3-4 specific, actionable findings]

RECOMMENDATIONS:
[1-2 paragraph recommendations for emissions reduction and reporting improvements]

Use professional language, avoid jargon, and focus on insights a CFO or board member would find valuable.`;

    const result = await llmClient.complete(prompt, {
      maxTokens: 800,
      temperature: 0.3,
    });

    reportLogger.info("Narrative generated successfully", {
      provider: result.provider,
      tokensUsed: result.tokens,
      textLength: result.text.length,
    });

    const narrative = parseNarrativeResponse(result.text);
    reportLogger.info("Narrative parsed", {
      hasSummary: !!narrative.executive_summary,
      findingsCount: narrative.key_findings.length,
      hasRecommendations: !!narrative.recommendations,
    });

    return narrative;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    reportLogger.error("LLM error during narrative generation", {
      error: errorMsg,
      stack: errorStack,
      hint: "Check HUGGINGFACE_TOKEN or NVIDIA_NIM_API_KEY in environment variables",
    });

    return {
      executive_summary: `Error generating narrative: ${errorMsg}. Ensure HUGGINGFACE_TOKEN is set in your environment. Get it from: https://huggingface.co/settings/tokens`,
      key_findings: [],
      recommendations: "",
    };
  }
}

function parseNarrativeResponse(text: string): AuditNarrative {
  const sections = {
    executive_summary: "",
    key_findings: [] as string[],
    recommendations: "",
  };

  const summaryMatch = text.match(/EXECUTIVE_SUMMARY:\s*([\s\S]*?)(?=KEY_FINDINGS:|RECOMMENDATIONS:|$)/);
  if (summaryMatch) {
    sections.executive_summary = summaryMatch[1].trim().substring(0, 800);
  }

  const findingsMatch = text.match(/KEY_FINDINGS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/);
  if (findingsMatch) {
    const lines = findingsMatch[1].trim().split("\n").filter((line) => line.trim().length > 0);
    sections.key_findings = lines
      .map((line) => line.replace(/^[-*•]\s+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 5);
  }

  const recsMatch = text.match(/RECOMMENDATIONS:\s*([\s\S]*?)$/);
  if (recsMatch) {
    sections.recommendations = recsMatch[1].trim().substring(0, 600);
  }

  if (!sections.executive_summary) {
    sections.executive_summary = text.substring(0, 800);
  }

  return sections;
}

export async function generateAuditNarrativeBatch(
  reportDataList: ReportData[],
): Promise<Map<string, AuditNarrative>> {
  const results = new Map<string, AuditNarrative>();
  for (const reportData of reportDataList) {
    const key = `${reportData.periodLabel}-${reportData.orgName}`;
    const narrative = await generateAuditNarrative(reportData);
    results.set(key, narrative);
  }
  return results;
}
