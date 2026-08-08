import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(_req: NextRequest) {
  try {
    await requireSession();

    const materials = await prisma.embodiedMaterial.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ materials });
  } catch (err) {
    return handleRouteError(err);
  }
}
