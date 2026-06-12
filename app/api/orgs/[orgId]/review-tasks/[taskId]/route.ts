import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateReviewTaskSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, taskId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const task = await prisma.reviewTask.findUnique({
      where: { id: taskId },
      select: { organizationId: true },
    });
    if (!task || task.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Task not found.", 404);
    }

    const body = updateReviewTaskSchema.parse(await req.json());

    const updated = await prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: body.status },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
