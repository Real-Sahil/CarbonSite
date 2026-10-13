// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { storageObject: { upsert: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));

const KEY = "org/o1/evidence/e1/f.pdf";

// The driver is chosen when the module loads, so each case sets its env and imports the module again.
async function loadStorage(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("STORAGE_BUCKET", "carbonsite");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("@/lib/storage");
}

beforeEach(() => {
  db.prisma.storageObject.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("storage download and upload types", () => {
  it("supabase: asks for an attachment under the /storage/v1 base", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signedURL: "/object/sign/carbonsite/org/o1/evidence/e1/f.pdf?token=t" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const storage = await loadStorage({
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://x.supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    const url = await storage.presignDownload(KEY);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://x.supabase.test/storage/v1/object/sign/carbonsite/org/o1/evidence/e1/f.pdf",
      expect.objectContaining({ method: "POST" }),
    );
    expect(url).toBe(
      "https://x.supabase.test/storage/v1/object/sign/carbonsite/org/o1/evidence/e1/f.pdf?token=t&download=f.pdf",
    );
  });

  it("r2: signs the GET with an attachment disposition", async () => {
    const storage = await loadStorage({
      STORAGE_DRIVER: "r2",
      STORAGE_ENDPOINT: "https://acct.r2.test",
      STORAGE_ACCESS_KEY_ID: "access-key",
      STORAGE_SECRET_ACCESS_KEY: "secret-key",
    });

    const url = await storage.presignDownload(KEY);

    expect(new URL(url).searchParams.get("response-content-disposition")).toBe('attachment; filename="f.pdf"');
  });

  it("db: an active type is stored and proxied as application/octet-stream", async () => {
    const storage = await loadStorage({ STORAGE_DRIVER: "db", NEXT_PUBLIC_APP_URL: "https://app.test" });

    const url = await storage.presignUpload("org/o1/evidence/e1/f.html", "text/html");
    expect(new URL(url).searchParams.get("contentType")).toBe("application/octet-stream");

    await storage.putObject("org/o1/evidence/e1/f.html", Buffer.from("<p>x</p>"), "text/html");
    expect(db.prisma.storageObject.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ contentType: "application/octet-stream" }),
        update: expect.objectContaining({ contentType: "application/octet-stream" }),
      }),
    );
  });
});
