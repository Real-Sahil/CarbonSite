import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Workflow execution tracking feature is not yet available" },
    { status: 501 }
  );
}
