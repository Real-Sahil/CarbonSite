import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Invalid verification token" },
        { status: 400 }
      );
    }

    const verificationToken = await prisma.reportVerificationToken.findUnique({
      where: { token },
      include: {
        report: {
          include: {
            snapshot: {
              include: {
                reportingPeriod: true,
              },
            },
            organization: true,
          },
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Verification token not found" },
        { status: 404 }
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This verification link has expired (90-day window)" },
        { status: 410 }
      );
    }

    const report = verificationToken.report;
    if (!report) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Associated report not found" },
        { status: 404 }
      );
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: report.organizationId,
        resourceId: report.id,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    await prisma.reportVerificationToken.update({
      where: { id: verificationToken.id },
      data: { accessCount: { increment: 1 } },
    });

    const verificationData = {
      report: {
        id: report.id,
        type: report.type,
        status: report.status,
        version: report.version,
        generatedAt: report.createdAt.toISOString(),
        sha256: report.pdfChecksum || "N/A",
        orgName: report.organization.name,
        snapshotId: report.snapshotId,
        snapshotVersion: report.snapshot?.version || 0,
        periodLabel: report.snapshot?.reportingPeriod?.label || "Unknown",
        periodStart: report.snapshot?.reportingPeriod?.startDate?.toISOString() || "",
        periodEnd: report.snapshot?.reportingPeriod?.endDate?.toISOString() || "",
        snapshotPublishedAt: report.snapshot?.publishedAt?.toISOString() || "",
      },
      auditTrail: auditLogs.map((log) => ({
        timestamp: log.createdAt.toISOString(),
        actor: log.actorUserId || "System",
        action: log.action,
      })),
      integrity: {
        verified: report.pdfChecksum ? true : false,
        message: report.pdfChecksum
          ? "Report integrity verified"
          : "Report integrity cannot be verified",
      },
      downloads: report.status === "ready"
        ? {
            pdf: report.pdfStorageKey
              ? `/api/public/reports/${report.id}/download?format=pdf`
              : null,
            csv: report.csvStorageKey
              ? `/api/public/reports/${report.id}/download?format=csv`
              : null,
          }
        : null,
    };

    return NextResponse.json(verificationData);
  } catch (error) {
    console.error("Report verification error:", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "An error occurred while verifying the report",
      },
      { status: 500 }
    );
  }
}
