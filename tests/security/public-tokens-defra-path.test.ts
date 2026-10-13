// @vitest-environment node
/**
 * lib/defra-dwt/client.ts joins its path onto the Defra API base. A path that does not start with a
 * single "/" (for example "@host/...") would move the request, and the bearer token with it, to another
 * host, so such paths are refused before any request is made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API = "https://waste-tracking.integration.api.defra.gov.uk";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("DEFRA_DWT_CLIENT_ID", "client-id");
  vi.stubEnv("DEFRA_DWT_CLIENT_SECRET", "client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("defraFetch path guard", () => {
  it.each(["@attacker.example/steal", "//attacker.example/steal", "/\\attacker.example/steal", "receipts", "", "https://attacker.example/x"])(
    "refuses the path %j before any request, so no token is sent",
    async (path) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { defraFetch } = await import("@/lib/defra-dwt/client");
      await expect(defraFetch(path)).rejects.toThrow("Defra request path must start with a single /");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("sends a normal path to the Defra host with the bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { defraFetch } = await import("@/lib/defra-dwt/client");
    const res = await defraFetch("/receipts/abc?x=1");
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${API}/receipts/abc?x=1`);
    expect(init.headers.get("Authorization")).toBe("Bearer tok");
  });
});
