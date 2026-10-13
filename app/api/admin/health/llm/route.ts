export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { configuredProviders, llmClient } from "@/lib/llm/client";
import { requirePlatformMember } from "@/lib/auth/session";
import * as Sentry from "@sentry/nextjs";
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
    } catch {
      // Provider errors can echo the API key, so their text is neither returned nor sent to Sentry.
      Sentry.captureException(new Error("LLM health check: no provider answered"));
      return NextResponse.json(
        { status: "error", providers, message: "No AI provider answered. Check the provider keys and quota, then try again." },
        { status: 502 },
      );
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
