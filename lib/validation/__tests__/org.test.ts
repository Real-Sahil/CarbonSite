import { describe, expect, test } from "vitest";
import { createInviteLinkSchema } from "../org";

describe("createInviteLinkSchema", () => {
  test("defaults public invite links to field worker access", () => {
    const parsed = createInviteLinkSchema.parse({ expiresInDays: 7 });

    expect(parsed.role).toBe("field_worker");
    expect(parsed.expiresInDays).toBe(7);
  });

  test("rejects privileged roles for public invite links", () => {
    const result = createInviteLinkSchema.safeParse({
      role: "admin",
      expiresInDays: 7,
    });

    expect(result.success).toBe(false);
  });
});
