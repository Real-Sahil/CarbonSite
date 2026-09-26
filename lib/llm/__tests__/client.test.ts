// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { completion_tokens: 3 } }), { status: 200 });

describe("LLM provider chain", () => {
  it("uses Groq first", async () => {
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("MISTRAL_API_KEY", "m");
    const fetchMock = vi.fn().mockResolvedValue(ok("OK"));
    vi.stubGlobal("fetch", fetchMock);
    const { llmClient } = await import("../client");
    const r = await llmClient.complete("hi");
    expect(r.provider).toBe("groq");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("falls back to Mistral when Groq is rate limited", async () => {
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("MISTRAL_API_KEY", "m");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(ok("OK"));
    vi.stubGlobal("fetch", fetchMock);
    const { llmClient } = await import("../client");
    const r = await llmClient.complete("hi");
    expect(r.provider).toBe("mistral");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.mistral.ai/v1/chat/completions");
  });

  it("reports unconfigured without keys and never calls out", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { llmClient } = await import("../client");
    expect(llmClient.isConfigured()).toBe(false);
    await expect(llmClient.complete("hi")).rejects.toThrow(/No LLM provider/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
