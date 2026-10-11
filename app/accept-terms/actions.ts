"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { TERMS_VERSION } from "@/lib/legal/terms";

const acceptSchema = z.object({ termsVersion: z.literal(TERMS_VERSION) });

/** Records that the signed-in person accepted the current Terms of Service. */
export async function acceptTerms(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reload the page to accept the current Terms of Service." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
  });
  return { ok: true };
}
