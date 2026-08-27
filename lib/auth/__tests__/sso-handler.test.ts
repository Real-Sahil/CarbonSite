import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifySsoUser, revokeSsoSession, getSsoSessionsByOrg, validateSsoConfiguration } from "../sso-handler";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    ssoConfiguration: {
      findUnique: vi.fn(),
    },
    ssoSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organizationMembership: {
      create: vi.fn(),
    },
  },
}));

describe("verifySsoUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing user and updates last activity", async () => {
    const mockSession = {
      id: "sess-123",
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      },
    };

    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue({
      provider: "okta",
      enabled: true,
      requireMfa: false,
      autoCreateUsers: false,
      autoAssignRole: null,
    } as any);

    vi.mocked(prisma.ssoSession.findUnique).mockResolvedValue(mockSession as any);

    const result = await verifySsoUser({
      orgId: "org-123",
      provider: "okta",
      userInfo: {
        email: "test@example.com",
        name: "Test User",
        providerUserId: "provider-123",
      },
    });

    expect(result).toEqual({
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      isNewUser: false,
      requiresMfa: false,
    });

    expect(prisma.ssoSession.update).toHaveBeenCalledWith({
      where: { id: "sess-123" },
      data: { lastActivityAt: expect.any(Date) },
    });
  });

  it("creates new user if auto-provisioning enabled", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue({
      provider: "okta",
      enabled: true,
      requireMfa: false,
      autoCreateUsers: true,
      autoAssignRole: "editor",
    } as any);

    vi.mocked(prisma.ssoSession.findUnique).mockResolvedValue(null);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const newUser = {
      id: "user-new",
      email: "new@example.com",
      name: "New User",
      emailVerified: true,
    };

    vi.mocked(prisma.user.create).mockResolvedValue(newUser as any);

    vi.mocked(prisma.ssoSession.create).mockResolvedValue({
      id: "sess-new",
    } as any);

    const result = await verifySsoUser({
      orgId: "org-123",
      provider: "okta",
      userInfo: {
        email: "new@example.com",
        name: "New User",
        providerUserId: "provider-new",
      },
    });

    expect(result.isNewUser).toBe(true);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        userId: "user-new",
        organizationId: "org-123",
        role: "editor",
      },
    });
  });

  it("throws if SSO not enabled", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue(null);

    await expect(
      verifySsoUser({
        orgId: "org-123",
        provider: "okta",
        userInfo: {
          email: "test@example.com",
          providerUserId: "provider-123",
        },
      })
    ).rejects.toThrow("SSO is not enabled");
  });
});

describe("revokeSsoSession", () => {
  it("deletes the session", async () => {
    vi.mocked(prisma.ssoSession.delete).mockResolvedValue({ id: "sess-123" } as any);

    await revokeSsoSession("sess-123");

    expect(prisma.ssoSession.delete).toHaveBeenCalledWith({
      where: { id: "sess-123" },
    });
  });
});

describe("getSsoSessionsByOrg", () => {
  it("returns sessions ordered by last activity", async () => {
    const sessions = [
      { id: "sess-1", userId: "user-1", provider: "okta", lastActivityAt: new Date(), createdAt: new Date() },
      { id: "sess-2", userId: "user-2", provider: "azure_ad", lastActivityAt: new Date(), createdAt: new Date() },
    ];

    vi.mocked(prisma.ssoSession.findMany).mockResolvedValue(sessions as any);

    const result = await getSsoSessionsByOrg("org-123");

    expect(result).toEqual(sessions);
    expect(prisma.ssoSession.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
      select: {
        id: true,
        userId: true,
        provider: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: "desc" },
    });
  });
});

describe("validateSsoConfiguration", () => {
  it("validates Okta configuration", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue({
      provider: "okta",
      metadataUrl: "https://org.okta.com/.well-known/openid-configuration",
      clientId: "client-123",
      clientSecret: "secret-123",
    } as any);

    const result = await validateSsoConfiguration("org-123");
    expect(result).toBe(true);
  });

  it("invalidates Okta config missing metadataUrl", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue({
      provider: "okta",
      clientId: "client-123",
      clientSecret: "secret-123",
    } as any);

    const result = await validateSsoConfiguration("org-123");
    expect(result).toBe(false);
  });

  it("validates Google Workspace configuration", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue({
      provider: "google_workspace",
      clientId: "client-123",
      clientSecret: "secret-123",
    } as any);

    const result = await validateSsoConfiguration("org-123");
    expect(result).toBe(true);
  });

  it("returns false if config not found", async () => {
    vi.mocked(prisma.ssoConfiguration.findUnique).mockResolvedValue(null);

    const result = await validateSsoConfiguration("org-123");
    expect(result).toBe(false);
  });
});
