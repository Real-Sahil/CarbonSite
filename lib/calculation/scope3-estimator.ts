// Scope 3 AI-powered emissions estimator.
// Uses the multi-provider LLM client (HuggingFace primary, NVIDIA NIM fallback).

import { llmClient } from '@/lib/llm/client';

export type Scope3EstimateRequest = {
  organizationId: string;
  spendCategory?: string;
  spendAmount?: number;
  currency?: string;
  orgRevenue?: number;
  industry?: string;
  employees?: number;
  facilities?: number;
  description?: string;
};

export type Scope3Estimate = {
  category: string;
  estimatedCo2e: number;
  estimatedCo2eLower: number;
  estimatedCo2eUpper: number;
  confidenceScore: number;
  methodology: string;
  recommendedUnit: string;
  recommendedAmount: number;
  suggestedRecordDescription: string;
  warnings: string[];
};

function parseEstimateResponse(jsonStr: string): Scope3Estimate {
  try {
    const jsonMatch =
      jsonStr.match(/```json\n?([\s\S]*?)\n?```/) || jsonStr.match(/(\{[\s\S]*\})/);
    const json = JSON.parse(jsonMatch ? jsonMatch[1] : jsonStr);

    return {
      category: json.category || 's3-purchased-goods',
      estimatedCo2e: parseFloat(json.estimatedCo2e) || 0,
      estimatedCo2eLower: parseFloat(json.estimatedCo2eLower) || 0,
      estimatedCo2eUpper: parseFloat(json.estimatedCo2eUpper) || 0,
      confidenceScore: Math.min(1, Math.max(0, parseFloat(json.confidenceScore) || 0.5)),
      methodology: json.methodology || 'LLM-based estimation',
      recommendedUnit: json.recommendedUnit || 'kg',
      recommendedAmount: parseFloat(json.recommendedAmount) || 0,
      suggestedRecordDescription: json.suggestedRecordDescription || json.description || '',
      warnings: json.warnings || [],
    };
  } catch (e) {
    throw new Error(`Failed to parse estimate response: ${String(e)}`);
  }
}

export async function estimateScope3(req: Scope3EstimateRequest): Promise<Scope3Estimate> {
  const spendType = req.spendCategory || 'general-business-travel';
  const spend = req.spendAmount || 0;
  const industryContext = req.industry
    ? `Industry: ${req.industry}`
    : 'Industry: Unknown (assume general business)';

  const prompt = `Estimate annual Scope 3 emissions for the following business context:
Spend Category: ${spendType}
Spend Amount: £${spend}
${industryContext}
${req.employees ? `Employees: ${req.employees}` : ''}
${req.facilities ? `Facilities: ${req.facilities}` : ''}
Description: ${req.description || 'No additional context'}

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

Use conservative estimates. Return ONLY the JSON object, no markdown.`;

  const result = await llmClient.complete(prompt, {
    systemPrompt:
      'You are a carbon emissions expert. Provide precise, conservative estimates based on industry data and the GHG Protocol. Always return JSON-formatted responses only, no markdown or explanation.',
    maxTokens: 500,
    temperature: 0.3,
  });

  return parseEstimateResponse(result.text);
}

export async function estimateScope3Batch(
  requests: Scope3EstimateRequest[],
): Promise<Scope3Estimate[]> {
  return Promise.all(requests.map((req) => estimateScope3(req)));
}

export async function suggestScope3Category(
  description: string,
  industry?: string,
): Promise<string> {
  const prompt = `Given a business expense or activity, classify it into one Scope 3 GHG Protocol category.
Expense: ${description}
Industry: ${industry || 'General'}

Return ONLY the category code in this format:
s3-<category>

Valid categories: s3-business-travel, s3-commuting, s3-purchased-goods, s3-upstream-transport, s3-waste, s3-employee-commuting

Return only the category code (e.g., "s3-business-travel"), no explanation.`;

  const result = await llmClient.complete(prompt, { maxTokens: 20, temperature: 0.2 });
  const match = result.text.trim().match(/s3-[\w-]+/);
  return match ? match[0] : 's3-purchased-goods';
}
