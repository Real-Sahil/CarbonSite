import { afterEach, describe, expect, test, vi } from "vitest";
import { sendTransactionalEmail } from "../email";
import { notificationLogger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  notificationLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("transactional email driver", () => {
  test("allows console email only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DRIVER", "console");

    await expect(
      sendTransactionalEmail({
        to: "worker@example.com",
        subject: "Invite",
        text: "Open your invite link.",
      }),
    ).resolves.toEqual({ provider: "console", messageId: null });

    expect(notificationLogger.debug).toHaveBeenCalledWith(
      "Email sent via console driver",
      expect.objectContaining({ to: "worker@example.com" }),
    );
  });

  test("skips sending in production when no email provider is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_DRIVER", "console");

    await expect(
      sendTransactionalEmail({
        to: "worker@example.com",
        subject: "Invite",
        text: "Open your invite link.",
      }),
    ).resolves.toEqual({ provider: "console", messageId: null });

    expect(notificationLogger.warn).toHaveBeenCalledWith(
      "Email sending skipped — RESEND_API_KEY not configured",
      expect.objectContaining({ to: "worker@example.com" }),
    );
  });
});
