import { afterEach, describe, expect, test, vi } from "vitest";
import { sendTransactionalEmail } from "../email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("transactional email driver", () => {
  test("allows console email only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DRIVER", "console");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      sendTransactionalEmail({
        to: "worker@example.com",
        subject: "Invite",
        text: "Open your invite link.",
      }),
    ).resolves.toEqual({ provider: "console", messageId: null });

    expect(log).toHaveBeenCalledWith(
      "[email:console]",
      expect.objectContaining({ to: "worker@example.com" }),
    );
  });

  test("rejects console email in production so invites do not look delivered", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_DRIVER", "console");

    await expect(
      sendTransactionalEmail({
        to: "worker@example.com",
        subject: "Invite",
        text: "Open your invite link.",
      }),
    ).rejects.toThrow("Transactional email is not configured");
  });
});
