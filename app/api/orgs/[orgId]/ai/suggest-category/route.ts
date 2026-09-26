import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { suggestCategory } from '@/lib/calculation/category-suggester';
import { apiError, handleRouteError } from '@/lib/validation/api';
import { aiAssistEnabled } from '@/lib/llm/org-consent';
import { z } from 'zod';

const SuggestCategorySchema = z.object({
  ocrText: z.string().min(1, 'OCR text is required'),
});

/**
 * POST /api/orgs/[orgId]/ai/suggest-category
 * Use the AI assistance chain (Groq, then Mistral) to suggest an emission category based on OCR-extracted document text.
 *
 * Request body:
 * {
 *   "ocrText": "Fuel Receipt for 45 liters of diesel, dated 2026-08-27..."
 * }
 *
 * Response:
 * {
 *   "category": "s1-mobile",
 *   "confidence": 0.92,
 *   "reasoning": "groq suggests 's1-mobile' with 92% confidence"
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Require editor+ role to use AI suggestions
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = await req.json();
    const { ocrText } = SuggestCategorySchema.parse(body);

    if (!(await aiAssistEnabled(orgId))) {
      return apiError("AI_ASSIST_OFF", "AI assistance is off for this organisation. An admin can turn it on in Settings.", 409);
    }
    const suggestion = await suggestCategory(ocrText);

    return NextResponse.json(suggestion, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
