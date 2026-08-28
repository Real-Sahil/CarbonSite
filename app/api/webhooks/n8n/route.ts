import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Workflow webhook feature is not yet available" },
    { status: 501 }
  );
}
