import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Supplier data requests are not yet available" },
    { status: 501 }
  );
}
