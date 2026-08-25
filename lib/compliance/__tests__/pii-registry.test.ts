import { describe, expect, test } from "vitest";
import { Prisma } from "@prisma/client";
import { PII_REGISTRY, PII_EXEMPT_MODELS } from "../pii-registry";

// Guards against silent PII-registry drift: a newly added model with an
// exact `userId` or `email` field must be either registered for DSAR
// export/erasure or explicitly exempted with a reason. This only catches
// that one naming convention — fields like createdByUserId/authorUserId
// follow a different pattern and were audited by hand when this registry
// was built; a future reviewer adding one of those to a new model should
// register it manually, the same way the existing entries were.
describe("PII registry completeness", () => {
  test("every model with an exact userId or email field is registered or exempted", () => {
    const models = Prisma.dmmf.datamodel.models;
    const registeredNames = new Set(PII_REGISTRY.map((e) => e.model));
    const exemptNames = new Set(Object.keys(PII_EXEMPT_MODELS));

    const unaccountedFor = models
      .filter((m) => m.fields.some((f) => f.name === "userId" || f.name === "email"))
      .filter((m) => !registeredNames.has(m.name) && !exemptNames.has(m.name))
      .map((m) => m.name);

    expect(unaccountedFor).toEqual([]);
  });

  test("every redact strategy entry has a redact function", () => {
    for (const entry of PII_REGISTRY) {
      if (entry.erasureStrategy === "redact") {
        expect(entry.redact, `${entry.model} is "redact" but has no redact()`).toBeDefined();
      }
    }
  });

  test("registry model names are unique", () => {
    const names = PII_REGISTRY.map((e) => e.model);
    expect(new Set(names).size).toBe(names.length);
  });
});
