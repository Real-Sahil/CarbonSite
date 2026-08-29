import { NextRequest, NextResponse } from "next/server";
import { llmClient } from "@/lib/llm/client";

/**
 * Diagnostic endpoint to verify LLM configuration
 * GET /api/admin/health/llm
 * Returns: { configured: boolean, provider: string | null, message: string }
 */
export async function GET(request: NextRequest) {
  const configured = llmClient.isConfigured();
  const hfToken = process.env.HUGGINGFACE_TOKEN;
  const nimKey = process.env.NVIDIA_NIM_API_KEY;

  if (!configured) {
    return NextResponse.json({
      configured: false,
      provider: null,
      message: "No LLM provider configured",
      details: {
        huggingface_token_set: !!hfToken,
        nvidia_nim_key_set: !!nimKey,
        hint: "Set HUGGINGFACE_TOKEN (get from https://huggingface.co/settings/tokens) or NVIDIA_NIM_API_KEY in your environment variables",
      },
      status: "error",
    });
  }

  // Determine which provider is active
  const provider = hfToken ? "huggingface" : nimKey ? "nvidia_nim" : "unknown";

  try {
    // Test the LLM with a simple prompt
    const result = await llmClient.complete("Say 'OK' only.", {
      maxTokens: 10,
      temperature: 0.3,
    });

    if (result.text.toLowerCase().includes("ok")) {
      return NextResponse.json({
        configured: true,
        provider,
        message: "LLM provider is working correctly",
        status: "ok",
        details: {
          provider_used: result.provider,
          tokens_used: result.tokens,
          response_length: result.text.length,
          response_preview: result.text.substring(0, 50),
        },
      });
    } else {
      return NextResponse.json({
        configured: true,
        provider,
        message: "LLM provider responded but behavior unexpected",
        status: "warning",
        details: {
          provider_used: result.provider,
          response: result.text,
        },
      });
    }
  } catch (error) {
    return NextResponse.json({
      configured: true,
      provider,
      message: "LLM provider configured but test call failed",
      status: "error",
      details: {
        error: error instanceof Error ? error.message : String(error),
        hint: "Check that your API key is valid and has remaining quota",
      },
    }, { status: 500 });
  }
}
