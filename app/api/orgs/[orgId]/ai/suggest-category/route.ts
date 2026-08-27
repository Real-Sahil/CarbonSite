import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { suggestCategory } from '@/lib/calculation/category-suggester';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';

const SuggestCategorySchema = z.object({
  ocrText: z.string().min(1, 'OCR text is required'),
});

/**
 * POST /api/orgs/[orgId]/ai/suggest-category
 * Use NVIDIA NIM to suggest an emission category based on OCR-extracted document text.
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
 *   "reasoning": "NVIDIA NIM analysis suggests 's1-mobile' with 92% confidence"
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Require editor+ role to use AI suggestions
    await requireOrgMember(orgId, 'admin', 'editor');

    const body = await req.json();
    const { ocrText } = SuggestCategorySchema.parse(body);

    // Call the category suggester
    const suggestion = await suggestCategory(ocrText);

    return NextResponse.json(suggestion, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
