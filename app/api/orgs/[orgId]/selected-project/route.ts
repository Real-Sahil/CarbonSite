export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { selectedProjectCookie } from "@/lib/project/selected";

const body = z.object({ projectId: z.string().min(1).max(64).nullable() }).strict();

// PUT: remember which project this person is working in (null = all projects).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);
    const { projectId } = body.parse(await req.json());
    const refs = await orgRefsError(orgId, { projectId });
    if (refs) return refs;
    const res = NextResponse.json({ projectId });
    res.cookies.set(selectedProjectCookie(orgId), projectId ?? "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: projectId ? 60 * 60 * 24 * 365 : 0,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
