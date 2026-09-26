export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { configuredProviders, llmClient } from "@/lib/llm/client";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

/**
 * GET /api/admin/health/llm (platform staff only): which AI providers are
 * configured and whether the chain answers. Each call spends free-tier quota,
 * so it is not public.
 */
export async function GET() {
  try {
    await requirePlatformMember();
    const providers = configuredProviders();
    if (providers.length === 0) {
      return NextResponse.json({ status: "error", providers, message: "Set GROQ_API_KEY and/or MISTRAL_API_KEY." }, { status: 503 });
    }
    try {
      const started = Date.now();
      const result = await llmClient.complete("Reply with the single word OK.", { maxTokens: 5, temperature: 0 });
      return NextResponse.json({
        status: /ok/i.test(result.text) ? "ok" : "warning",
        providers,
        answeredBy: result.provider,
        latencyMs: Date.now() - started,
        preview: result.text.slice(0, 20),
      });
    } catch (err) {
      return NextResponse.json(
        { status: "error", providers, message: err instanceof Error ? err.message.replace(/Bearer\s+\S+/g, "Bearer ***") : String(err) },
        { status: 502 },
      );
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
