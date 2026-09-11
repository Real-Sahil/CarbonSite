import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Authorization check
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Import and run seed
    const seedModule = await import("@/prisma/seed");
    await seedModule.runSeed();

    return NextResponse.json({ success: true, message: "Seed completed successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: String(error) },
      { status: 500 }
    );
  }
}
