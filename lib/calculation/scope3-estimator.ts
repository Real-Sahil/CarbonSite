// Scope 3 AI-powered emissions estimator using NVIDIA LLM API.
// Estimates missing Scope 3 data based on organizational context and industry norms.

import { Decimal } from "@prisma/client/runtime/library";

export type Scope3EstimateRequest = {
  organizationId: string;
  spendCategory?: string; // e.g. "business-travel", "logistics", "purchased-goods"
  spendAmount?: number; // in GBP
  currency?: string; // default: "GBP"
  orgRevenue?: number; // annual revenue for benchmarking
  industry?: string; // e.g. "construction", "logistics", "manufacturing", "retail"
  employees?: number;
  facilities?: number;
  description?: string; // free-form context
};

export type Scope3Estimate = {
  category: string;
  estimatedCo2e: number; // kg CO2e
  estimatedCo2eLower: number; // confidence interval lower bound (±%)
  estimatedCo2eUpper: number; // confidence interval upper bound (±%)
  confidenceScore: number; // 0-1, higher = more reliable
  methodology: string; // explain what assumptions were used
  recommendedUnit: string;
  recommendedAmount: number;
  suggestedRecordDescription: string;
  warnings: string[];
};

// NVIDIA LLM endpoint and model configuration
const NVIDIA_API_BASE = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = "meta/llama-3.1-405b-instruct"; // High-capacity model for accuracy

interface NvidiaResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

async function callNvidiaLLM(prompt: string): Promise<string> {
  if (!NVIDIA_API_KEY) {
    throw new Error("NVIDIA_API_KEY not configured");
  }

  const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a carbon emissions expert. Provide precise, conservative estimates based on industry data and the GHG Protocol. Always return JSON-formatted responses only, no markdown or explanation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent, deterministic outputs
      max_tokens: 500,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as NvidiaResponse;
    throw new Error(`NVIDIA API error: ${error.error?.message || response.statusText}`);
  }

  const data = (await response.json()) as NvidiaResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("NVIDIA API returned empty response");
  }

  return content;
}

async function parseEstimateResponse(jsonStr: string): Promise<Scope3Estimate> {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = jsonStr.match(/```json\n?([\s\S]*?)\n?```/) || jsonStr.match(/({[\s\S]*})/);
    const json = JSON.parse(jsonMatch ? jsonMatch[1] : jsonStr);

    return {
      category: json.category || "s3-purchased-goods",
      estimatedCo2e: parseFloat(json.estimatedCo2e) || 0,
      estimatedCo2eLower: parseFloat(json.estimatedCo2eLower) || 0,
      estimatedCo2eUpper: parseFloat(json.estimatedCo2eUpper) || 0,
      confidenceScore: Math.min(1, Math.max(0, parseFloat(json.confidenceScore) || 0.5)),
      methodology: json.methodology || "NVIDIA LLM-based estimation",
      recommendedUnit: json.recommendedUnit || "kg",
      recommendedAmount: parseFloat(json.recommendedAmount) || 0,
      suggestedRecordDescription: json.suggestedRecordDescription || json.description || "",
      warnings: json.warnings || [],
    };
  } catch (e) {
    throw new Error(`Failed to parse NVIDIA estimate response: ${String(e)}`);
  }
}

export async function estimateScope3(req: Scope3EstimateRequest): Promise<Scope3Estimate> {
  const spendType = req.spendCategory || "general-business-travel";
  const spend = req.spendAmount || 0;
  const industryContext = req.industry
    ? `Industry: ${req.industry}`
    : "Industry: Unknown (assume general business)";
  const employeeContext = req.employees ? `Employees: ${req.employees}` : "";
  const facilityContext = req.facilities ? `Facilities: ${req.facilities}` : "";

  const prompt = `
Estimate annual Scope 3 emissions for the following business context:
Spend Category: ${spendType}
Spend Amount: £${spend}
${industryContext}
${employeeContext}
${facilityContext}
Description: ${req.description || "No additional context"}

Based on industry benchmarks and the GHG Protocol, return ONLY a JSON object with:
{
  "category": "s3-<category>",
  "estimatedCo2e": <number in kg CO2e>,
  "estimatedCo2eLower": <lower bound in kg CO2e>,
  "estimatedCo2eUpper": <upper bound in kg CO2e>,
  "confidenceScore": <0.0-1.0>,
  "methodology": "<brief explanation of estimation basis>",
  "recommendedUnit": "kg",
  "recommendedAmount": <converted to kg>,
  "suggestedRecordDescription": "<what should be recorded>",
  "warnings": ["<any caveats>"]
}

Use conservative estimates. Confidence intervals should reflect uncertainty (wider for indirect categories, narrower for direct spend). Return ONLY the JSON object, no markdown.
`;

  const response = await callNvidiaLLM(prompt);
  return parseEstimateResponse(response);
}

// Batch estimation for multiple spend categories
export async function estimateScope3Batch(
  requests: Scope3EstimateRequest[],
): Promise<Scope3Estimate[]> {
  return Promise.all(requests.map((req) => estimateScope3(req)));
}

// Helper: suggest Scope 3 category based on spend description
export async function suggestScope3Category(
  description: string,
  industry?: string,
): Promise<string> {
  const prompt = `
Given a business expense or activity, classify it into one Scope 3 GHG Protocol category.
Expense: ${description}
Industry: ${industry || "General"}

Return ONLY the category code in this format:
s3-<category>

Valid categories: s3-business-travel, s3-commuting, s3-purchased-goods, s3-upstream-transport, s3-waste, s3-employee-commuting

Return only the category code (e.g., "s3-business-travel"), no explanation.
`;

  const response = await callNvidiaLLM(prompt);
  const match = response.trim().match(/s3-[\w-]+/);
  return match ? match[0] : "s3-purchased-goods";
}
