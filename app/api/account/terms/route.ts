export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { apiError, handleRouteError } from "@/lib/validation/api";

const acceptSchema = z.object({ termsVersion: z.literal(TERMS_VERSION) });

/** Records that the signed-in person accepted the current Terms of Service. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = acceptSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("TERMS_VERSION_MISMATCH", "Reload the page to accept the current Terms of Service.", 400);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
    });
    return Response.json({ ok: true, termsVersion: TERMS_VERSION });
  } catch (err) {
    return handleRouteError(err);
  }
}
