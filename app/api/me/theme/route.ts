export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { THEME_CHOICES } from "@/lib/theme/preference";
import { apiError, handleRouteError } from "@/lib/validation/api";

const bodySchema = z.object({ theme: z.enum(THEME_CHOICES) });

/** Saves the signed-in person's appearance. Any role may set it; it is theirs, not the organisation's. */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("INVALID_THEME", "Choose light, dark or system.", 400, parsed.error.flatten());
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { themePreference: parsed.data.theme },
    });
    return NextResponse.json({ theme: parsed.data.theme });
  } catch (err) {
    return handleRouteError(err);
  }
}
