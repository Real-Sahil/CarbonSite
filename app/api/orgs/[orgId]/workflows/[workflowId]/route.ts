import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Workflow management feature is not yet available" },
    { status: 501 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Workflow management feature is not yet available" },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { code: "NOT_IMPLEMENTED", message: "Workflow management feature is not yet available" },
    { status: 501 }
  );
}
