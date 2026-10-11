import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

import { hashApiKey, mintApiKey, validateApiKey } from "../api-key";

describe("API keys", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("mints csk_ keys whose stored hash is the SHA-256 of the secret", () => {
    const minted = mintApiKey();
    expect(minted.secret.startsWith("csk_")).toBe(true);
    expect(minted.prefix).toBe(minted.secret.slice(0, 8));
    expect(minted.keyHash).toBe(hashApiKey(minted.secret));
    expect(minted.keyHash).not.toContain(minted.secret);
  });

  it("mints a different secret each time", () => {
    expect(mintApiKey().secret).not.toBe(mintApiKey().secret);
  });

  it("accepts a freshly minted key and returns its organisation", async () => {
    const minted = mintApiKey();
    findUnique.mockImplementation(async ({ where }: { where: { keyHash: string } }) =>
      where.keyHash === minted.keyHash
        ? { organizationId: "org-a", expiresAt: null, lastUsedAt: null }
        : null,
    );
    await expect(validateApiKey(`Bearer ${minted.secret}`)).resolves.toBe("org-a");
  });

  it("rejects a key that is not in the table", async () => {
    findUnique.mockResolvedValue(null);
    await expect(validateApiKey(`Bearer ${mintApiKey().secret}`)).rejects.toThrow("API key not found");
  });

  it("rejects an expired key", async () => {
    const minted = mintApiKey();
    findUnique.mockResolvedValue({ organizationId: "org-a", expiresAt: new Date(0), lastUsedAt: null });
    await expect(validateApiKey(`Bearer ${minted.secret}`)).rejects.toThrow("expired");
  });

  it("rejects a key without the csk_ prefix", async () => {
    await expect(validateApiKey("Bearer sk_abc")).rejects.toThrow("Invalid API key format");
  });
});
