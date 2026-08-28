import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Report verification is not yet available" },
    { status: 501 }
  );
}
