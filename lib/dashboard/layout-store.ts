import { prisma } from "@/lib/db";
import { layoutSchema, type Layout } from "./widgets";

export const SURFACE = "dashboard";

const parse = (raw: unknown): Layout | null => {
  const r = layoutSchema.safeParse(raw);
  return r.success ? r.data : null;
};

/** The person's saved layout, else the organisation's default, else null. Always inside the organisation. */
export async function loadStoredLayout(orgId: string, userId: string): Promise<{ layout: Layout | null; source: "personal" | "organisation" | "preset" }> {
  const rows = await prisma.dashboardLayout.findMany({
    where: { organizationId: orgId, surface: SURFACE, userKey: { in: ["org", userId] } },
    select: { userKey: true, layout: true },
  });
  const personal = parse(rows.find((r) => r.userKey === userId)?.layout);
  if (personal) return { layout: personal, source: "personal" };
  const org = parse(rows.find((r) => r.userKey === "org")?.layout);
  return org ? { layout: org, source: "organisation" } : { layout: null, source: "preset" };
}
