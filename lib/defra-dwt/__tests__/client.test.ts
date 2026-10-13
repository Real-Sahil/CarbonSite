// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_PATH = "/oauth2/token";
const API = "https://waste-tracking.integration.api.defra.gov.uk";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const isToken = (url: unknown) => String(url).includes(TOKEN_PATH);

beforeEach(() => {
  vi.stubEnv("DEFRA_DWT_CLIENT_ID", "client-id");
  vi.stubEnv("DEFRA_DWT_CLIENT_SECRET", "client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Defra DWT token client", () => {
  it("asks for a token with Basic auth and the same credentials in the form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ access_token: "tok", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getDefraAccessToken } = await import("../client");
    await expect(getDefraAccessToken()).resolves.toBe("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(TOKEN_PATH);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
    expect(String(init.body)).toBe("grant_type=client_credentials&client_id=client-id&client_secret=client-secret");
  });

  it("shares one token request between concurrent callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ access_token: "tok", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getDefraAccessToken } = await import("../client");
    await expect(Promise.all([getDefraAccessToken(), getDefraAccessToken()])).resolves.toEqual(["tok", "tok"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes a minute before expires_in runs out", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ access_token: "tok-1", expires_in: 3600 }))
      .mockResolvedValueOnce(reply({ access_token: "tok-2", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getDefraAccessToken } = await import("../client");
    await expect(getDefraAccessToken()).resolves.toBe("tok-1");
    now += 3_539_999;
    await expect(getDefraAccessToken()).resolves.toBe("tok-1");
    now += 1;
    await expect(getDefraAccessToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("assumes 300 s when expires_in is missing", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ access_token: "tok-1" }))
      .mockResolvedValueOnce(reply({ access_token: "tok-2" }));
    vi.stubGlobal("fetch", fetchMock);
    const { getDefraAccessToken } = await import("../client");
    await getDefraAccessToken();
    now += 239_999; // 300 s less the 60 s margin
    await expect(getDefraAccessToken()).resolves.toBe("tok-1");
    now += 1;
    await expect(getDefraAccessToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("replaces a refused token once and repeats the call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ access_token: "old", expires_in: 3600 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(reply({ access_token: "new", expires_in: 3600 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { defraFetch } = await import("../client");
    const res = await defraFetch("/receipts", { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
    const auth = fetchMock.mock.calls
      .filter(([url]) => String(url).startsWith(API))
      .map(([, init]) => init.headers.get("Authorization"));
    expect(auth).toEqual(["Bearer old", "Bearer new"]);
  });

  it("returns the second 401 without a third try", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      isToken(url) ? reply({ access_token: "tok", expires_in: 3600 }) : new Response("", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { defraFetch } = await import("../client");
    const res = await defraFetch("/receipts");
    expect(res.status).toBe(401);
    expect(fetchMock.mock.calls.filter(([url]) => isToken(url))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => !isToken(url))).toHaveLength(2);
  });

  it("reports only the HTTP status when Defra refuses the credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(reply({ error: "invalid_client", echo: "client-secret" }, 401)),
    );
    const { getDefraAccessToken, DefraAuthError } = await import("../client");
    const err = await getDefraAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DefraAuthError);
    expect(err).toHaveProperty("status", 401);
    expect((err as Error).message).toBe("Defra token request failed with HTTP 401");
  });

  it("refuses to call Defra without both credentials", async () => {
    vi.stubEnv("DEFRA_DWT_CLIENT_SECRET", " ");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getDefraAccessToken } = await import("../client");
    await expect(getDefraAccessToken()).rejects.toThrow(
      "DEFRA_DWT_CLIENT_ID and DEFRA_DWT_CLIENT_SECRET must be set",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
