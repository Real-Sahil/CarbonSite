import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { AnalyticsSummary } from "@/components/analytics/AnalyticsSummary";
import { EmissionsByScopeChart } from "@/components/analytics/EmissionsByScopeChart";
import { EmissionsTrendChart } from "@/components/analytics/EmissionsTrendChart";
import { FacilityComparisonChart } from "@/components/analytics/FacilityComparisonChart";
import { CategoryBreakdownChart } from "@/components/analytics/CategoryBreakdownChart";

interface AnalyticsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to view analytics.
          </p>
        </div>
      );
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load analytics. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Emissions Analytics
          </h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Track your organization&apos;s emissions across scopes, facilities, and categories with detailed insights and trends.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        {/* Summary metrics */}
        <div>
          <h2 className="text-lg font-semibold text-[#111827] mb-4">
            Key Metrics
          </h2>
          <AnalyticsSummary orgId={orgId} />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Emissions by Scope */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-sm">
            <h3 className="text-base font-semibold text-[#111827] mb-4">
              Emissions by Scope
            </h3>
            <EmissionsByScopeChart orgId={orgId} />
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-sm">
            <h3 className="text-base font-semibold text-[#111827] mb-4">
              Category Breakdown
            </h3>
            <CategoryBreakdownChart orgId={orgId} />
          </div>
        </div>

        {/* Emissions Trend */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827] mb-4">
            Emissions Trend (Last 30 Days)
          </h3>
          <EmissionsTrendChart orgId={orgId} days={30} />
        </div>

        {/* Facility Comparison */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827] mb-4">
            Top Facilities by Emissions
          </h3>
          <FacilityComparisonChart orgId={orgId} limit={10} />
        </div>
      </div>
    </div>
  );
}
