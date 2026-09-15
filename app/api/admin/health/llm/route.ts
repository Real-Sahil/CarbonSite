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
  // Client checks NVIDIA_API_KEY first, then NVIDIA_NIM_API_KEY as fallback
  const nvidiKey = process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY;
  const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

  if (!configured) {
    return NextResponse.json({
      configured: false,
      provider: null,
      message: "No LLM provider configured",
      details: {
        huggingface_token_set: !!hfToken,
        nvidia_api_key_set: !!nvidiKey,
        nvidia_nim_base_url: nimBaseUrl,
        hint: "Set NVIDIA_API_KEY (Kimi via NVIDIA NIM) or HUGGINGFACE_TOKEN in your environment variables",
      },
      status: "error",
    });
  }

  // Determine which provider will be tried first
  const provider = nvidiKey ? "kimi_via_nvidia_nim" : hfToken ? "huggingface" : "unknown";

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
          nvidia_nim_base_url: nimBaseUrl,
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
        nvidia_nim_base_url: nimBaseUrl,
        hint: "Check NVIDIA_API_KEY is valid and NVIDIA_NIM_BASE_URL points to https://integrate.api.nvidia.com/v1 (not localhost)",
      },
    }, { status: 500 });
  }
}
