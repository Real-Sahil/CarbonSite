import { prisma } from "@/lib/db";
import { subDays, startOfDay } from "date-fns";

export interface SupplierMetrics {
  email: string;
  name: string;
  status: string;
  loginCount7d: number;
  loginCount30d: number;
  loginCount90d: number;
  lastLoginAt?: Date;
  totalAssigned: number;
  totalSubmitted: number;
  submissionRate: number;
  avgResponseTimeDays: number;
  createdAt: Date;
}

export interface AggregatedMetrics {
  activeSuppliersThisMonth: number;
  totalSuppliers: number;
  stalledRequests: number;
  totalRequests: number;
  approvalRate: number;
  avgResponseTimeDays: number;
  loginActivityByDate: Array<{ date: string; count: number }>;
  suppliers: SupplierMetrics[];
}

export async function getSupplierMetrics(
  organizationId: string,
  period: number = 30,
): Promise<AggregatedMetrics> {
  const now = new Date();
  const periodStart = subDays(now, period);
  const thirtyDaysAgo = subDays(now, 30);
  const ninetyDaysAgo = subDays(now, 90);

  // Get all supplier users
  const suppliers = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      role: "supplier",
      terminatedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          sessions: {
            where: {
              createdAt: {
                gte: ninetyDaysAgo,
              },
            },
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  // Get all supplier data requests for this org
  const requests = await prisma.supplierDataRequest.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      supplierEmail: true,
      status: true,
      sentAt: true,
      submittedAt: true,
      expiresAt: true,
      approvedByUserId: true,
    },
  });

  // Group requests by supplier email
  const requestsBySupplier = new Map<string, typeof requests>();
  for (const req of requests) {
    if (!requestsBySupplier.has(req.supplierEmail)) {
      requestsBySupplier.set(req.supplierEmail, []);
    }
    requestsBySupplier.get(req.supplierEmail)!.push(req);
  }

  // Calculate supplier metrics
  const supplierMetrics: SupplierMetrics[] = suppliers.map((membership) => {
    const user = membership.user;
    const supplierRequests = requestsBySupplier.get(user.email) || [];

    // Login counts
    const sessionsInPeriod = user.sessions.filter(
      (s) => s.createdAt >= periodStart,
    );
    const sessions7d = user.sessions.filter((s) => s.createdAt >= subDays(now, 7));
    const sessions30d = user.sessions.filter((s) => s.createdAt >= thirtyDaysAgo);
    const sessions90d = user.sessions.filter((s) => s.createdAt >= ninetyDaysAgo);

    const loginCount7d = new Set(sessions7d.map((s) => startOfDay(s.createdAt).toISOString())).size;
    const loginCount30d = new Set(sessions30d.map((s) => startOfDay(s.createdAt).toISOString())).size;
    const loginCount90d = new Set(sessions90d.map((s) => startOfDay(s.createdAt).toISOString())).size;

    // Submission metrics
    const submitted = supplierRequests.filter((r) =>
      ["submitted", "flagged", "approved", "rejected", "converted"].includes(r.status),
    );
    const totalAssigned = supplierRequests.length;
    const totalSubmitted = submitted.length;
    const submissionRate = totalAssigned > 0 ? (totalSubmitted / totalAssigned) * 100 : 0;

    // Response time
    let totalResponseTime = 0;
    let responseCount = 0;
    for (const req of submitted) {
      if (req.submittedAt) {
        const responseTime = (req.submittedAt.getTime() - req.sentAt.getTime()) / (1000 * 60 * 60 * 24);
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    const avgResponseTimeDays = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      email: user.email,
      name: user.name || user.email,
      status: "active",
      loginCount7d,
      loginCount30d,
      loginCount90d,
      lastLoginAt: user.sessions.length > 0 ? user.sessions[0].createdAt : undefined,
      totalAssigned,
      totalSubmitted,
      submissionRate,
      avgResponseTimeDays: Math.round(avgResponseTimeDays * 100) / 100,
      createdAt: membership.createdAt,
    };
  });

  // Calculate aggregated metrics
  const activeSuppliersThisMonth = new Set(
    suppliers
      .filter((s) => s.user.sessions.some((sess) => sess.createdAt >= thirtyDaysAgo))
      .map((s) => s.user.email),
  ).size;

  const stalledRequests = requests.filter(
    (r) => r.expiresAt < now && !["submitted", "approved", "rejected", "converted"].includes(r.status),
  ).length;

  const approvedRequests = requests.filter((r) => r.status === "approved").length;
  const submittedRequests = requests.filter((r) =>
    ["submitted", "flagged", "approved", "rejected", "converted"].includes(r.status),
  ).length;
  const approvalRate = submittedRequests > 0 ? (approvedRequests / submittedRequests) * 100 : 0;

  // Calculate login activity by date
  const loginActivityMap = new Map<string, number>();
  const activityStart = subDays(now, period);
  for (let i = 0; i < period; i++) {
    const date = subDays(now, period - i);
    loginActivityMap.set(startOfDay(date).toISOString().split("T")[0], 0);
  }

  for (const supplier of suppliers) {
    for (const session of supplier.user.sessions) {
      if (session.createdAt >= activityStart) {
        const dateKey = startOfDay(session.createdAt).toISOString().split("T")[0];
        loginActivityMap.set(dateKey, (loginActivityMap.get(dateKey) || 0) + 1);
      }
    }
  }

  const loginActivityByDate = Array.from(loginActivityMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      count: Math.min(count, suppliers.length), // Cap at total suppliers
    }));

  const totalResponseTime = supplierMetrics.reduce((sum, s) => sum + s.avgResponseTimeDays, 0);
  const avgResponseTimeDays =
    supplierMetrics.length > 0 ? Math.round((totalResponseTime / supplierMetrics.length) * 100) / 100 : 0;

  return {
    activeSuppliersThisMonth,
    totalSuppliers: suppliers.length,
    stalledRequests,
    totalRequests: requests.length,
    approvalRate: Math.round(approvalRate * 100) / 100,
    avgResponseTimeDays,
    loginActivityByDate,
    suppliers: supplierMetrics.sort((a, b) => b.loginCount30d - a.loginCount30d),
  };
}
