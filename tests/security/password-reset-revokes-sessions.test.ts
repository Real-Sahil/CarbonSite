// @vitest-environment node
/**
 * A password reset must end every session on the account. Better Auth only does
 * that when emailAndPassword.revokeSessionsOnPasswordReset is set, so this pins
 * the option in the config handed to betterAuth().
 */
import { describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.hoisted(() => vi.fn((options: unknown) => ({ options })));

vi.mock("better-auth", () => ({ betterAuth: betterAuthMock }));
vi.mock("better-auth/api", () => ({
  APIError: class APIError extends Error {},
  createAuthMiddleware: (handler: unknown) => handler,
}));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/notifications/email", () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("auth config: password reset", () => {
  it("ends all sessions when a password is reset", async () => {
    await import("@/lib/auth/index");

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      emailAndPassword: { enabled: boolean; revokeSessionsOnPasswordReset?: boolean };
    };
    expect(options.emailAndPassword.enabled).toBe(true);
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });
});
