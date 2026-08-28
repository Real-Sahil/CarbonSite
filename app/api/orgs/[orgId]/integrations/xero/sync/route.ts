import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Xero integration is not yet available" },
    { status: 501 }
  );
}
