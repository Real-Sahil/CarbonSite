import { llmClient } from '@/lib/llm/client';

const VALID_CATEGORIES = {
  scope1: ['s1-stationary', 's1-mobile', 's1-fugitive'],
  scope2: ['s2-electricity-lb', 's2-electricity-mb'],
  scope3: [
    's3-business-travel',
    's3-commuting',
    's3-purchased-goods',
    's3-upstream-transport',
  ],
};

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning: string;
}

export async function suggestCategory(ocrText: string): Promise<CategorySuggestion> {
  if (!ocrText || ocrText.trim().length === 0) {
    return {
      category: 's1-stationary',
      confidence: 0,
      reasoning: 'No document text provided',
    };
  }

  try {
    const prompt = `You are an emissions classification expert. Analyze the following extracted text from a construction/operations document and determine which GHG Protocol emission category best fits.

Document Text:
"""
${ocrText.substring(0, 1000)}
"""

Emission Categories:
Scope 1 (Direct Emissions):
- s1-stationary: Stationary fuel combustion (boilers, furnaces, heaters)
- s1-mobile: Mobile fuel combustion (vehicles, equipment, generators)
- s1-fugitive: Fugitive emissions (refrigerants, process leaks)

Scope 2 (Purchased Energy):
- s2-electricity-lb: Purchased electricity (location-based method)
- s2-electricity-mb: Purchased electricity (market-based method)

Scope 3 (Other Indirect):
- s3-business-travel: Employee business travel
- s3-commuting: Employee commuting
- s3-purchased-goods: Purchased goods and services
- s3-upstream-transport: Upstream transportation and distribution

Based on the document text, respond with ONLY these two fields on separate lines (no other text):
CATEGORY: [category_code]
CONFIDENCE: [0.0 to 1.0]

Example:
CATEGORY: s1-mobile
CONFIDENCE: 0.92`;

    const result = await llmClient.complete(prompt, {
      maxTokens: 100,
      temperature: 0.2,
    });

    const lines = result.text.split('\n').map((l) => l.trim());
    let category = 's1-stationary';
    let confidence = 0.5;

    for (const line of lines) {
      if (line.startsWith('CATEGORY:')) {
        const parsed = line.replace('CATEGORY:', '').trim().toLowerCase();
        if (isValidCategory(parsed)) {
          category = parsed;
        }
      } else if (line.startsWith('CONFIDENCE:')) {
        const parsed = parseFloat(line.replace('CONFIDENCE:', '').trim());
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          confidence = parsed;
        }
      }
    }

    return {
      category,
      confidence,
      reasoning: `${result.provider} suggests "${category}" with ${(confidence * 100).toFixed(0)}% confidence`,
    };
  } catch (error) {
    console.error('Category suggestion error:', error);
    return {
      category: 's1-stationary',
      confidence: 0,
      reasoning: `Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}. Please categorize manually.`,
    };
  }
}

export async function suggestCategoriesBatch(
  documents: Array<{ id: string; text: string }>,
): Promise<Map<string, CategorySuggestion>> {
  const results = new Map<string, CategorySuggestion>();
  for (const doc of documents) {
    const suggestion = await suggestCategory(doc.text);
    results.set(doc.id, suggestion);
  }
  return results;
}

function isValidCategory(category: string): boolean {
  return (
    VALID_CATEGORIES.scope1.includes(category) ||
    VALID_CATEGORIES.scope2.includes(category) ||
    VALID_CATEGORIES.scope3.includes(category)
  );
}

export function getAllCategories(): Record<string, string[]> {
  return VALID_CATEGORIES;
}
