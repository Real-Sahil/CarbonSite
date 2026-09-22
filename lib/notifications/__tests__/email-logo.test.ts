import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  brandingLogoUrl: (orgId: string) => `https://app.example/api/public/orgs/${orgId}/branding/logo`,
  presignDownload: vi.fn(async (key: string) => `https://signed.example/${key}`),
}));

const { resolveEmailLogoUrl } = await import("../email");

describe("resolveEmailLogoUrl", () => {
  test("keeps a stored proxy URL", async () => {
    await expect(
      resolveEmailLogoUrl({ logoPublicUrl: "https://app.example/api/public/orgs/o1/branding/logo" }),
    ).resolves.toBe("https://app.example/api/public/orgs/o1/branding/logo");
  });

  test("replaces a direct storage-bucket URL with the proxy URL, so a private bucket still serves email logos", async () => {
    await expect(
      resolveEmailLogoUrl({
        logoPublicUrl: "https://x.supabase.co/storage/v1/object/public/carbonsite/org/o1/branding/logo.webp",
        logoStorageKey: "org/o1/branding/logo.webp",
      }),
    ).resolves.toBe("https://app.example/api/public/orgs/o1/branding/logo");
  });

  test("builds the proxy URL from the key when nothing is stored", async () => {
    await expect(
      resolveEmailLogoUrl({ reportHeaderLogoKey: "org/o2/branding/logo.png" }),
    ).resolves.toBe("https://app.example/api/public/orgs/o2/branding/logo");
  });

  test("returns null without a logo", async () => {
    await expect(resolveEmailLogoUrl({})).resolves.toBeNull();
  });
});
