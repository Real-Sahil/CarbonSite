export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Site zones feature is not yet available" },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Site zones feature is not yet available" },
    { status: 501 }
  );
}
