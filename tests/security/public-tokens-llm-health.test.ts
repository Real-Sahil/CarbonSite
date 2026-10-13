// @vitest-environment node
/**
 * GET /api/admin/health/llm calls a paid AI provider. When no provider answers, the provider's error text
 * can echo the API key, so it must reach neither the response nor Sentry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({
  configuredProviders: vi.fn(() => ["groq", "mistral"]),
  complete: vi.fn(),
}));

vi.mock("@/lib/llm/client", () => ({
  configuredProviders: llm.configuredProviders,
  llmClient: { complete: llm.complete },
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requirePlatformMember: vi.fn(async () => ({ userId: "platform-1" })),
}));
vi.mock("@sentry/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/nextjs")>()),
  captureException: vi.fn(() => "event-1"),
}));

import * as Sentry from "@sentry/nextjs";
import { GET } from "@/app/api/admin/health/llm/route";

// A made-up key in the shape a provider error would echo back.
const KEY = "sk-test-EXAMPLEKEY0123456789";

beforeEach(() => {
  vi.clearAllMocks();
  llm.configuredProviders.mockReturnValue(["groq", "mistral"]);
});

describe("LLM health check", () => {
  it("reports ok when a provider answers", async () => {
    llm.complete.mockResolvedValue({ text: "OK", provider: "groq" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", answeredBy: "groq", providers: ["groq", "mistral"] });
  });

  it("does not return or report a provider error that carries the API key", async () => {
    llm.complete.mockRejectedValue(new Error(`401 Unauthorized: invalid key ${KEY}`));
    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ status: "error", providers: ["groq", "mistral"] });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(Sentry.captureException).mock.calls[0][0])).not.toContain(KEY);
  });
});
