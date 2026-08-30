import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertCircle, FileText } from "lucide-react";
import { DrillDownDashboard } from "@/components/analytics/DrillDownDashboard";
import { AnomalyHighlightingPanel } from "@/components/analytics/AnomalyHighlightingPanel";
import { CustomReportBuilder } from "@/components/analytics/CustomReportBuilder";

interface AnalyticsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { orgId } = await params;
  await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

  const currentPeriod = await prisma.reportingPeriod.findFirst({
    where: { organizationId: orgId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, label: true },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advanced Analytics</h1>
        <p className="text-gray-600 mt-2">
          Explore, analyze, and report on your emissions data with powerful drill-down capabilities,
          anomaly detection, and custom report generation.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Drill-Down Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              Multi-dimensional filtering and analysis by scope, category, and facility.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Anomaly Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              Automatically identify statistical outliers, trends, and data quality issues.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Custom Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              Generate and export comprehensive reports in PDF, CSV, or JSON formats.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="drill-down" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="drill-down" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Drill-Down</span>
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Anomalies</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Drill-Down Tab */}
        <TabsContent value="drill-down" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Dimensional Analysis</CardTitle>
              <CardDescription>
                Explore your emissions data across different dimensions with interactive filtering
                and comparison capabilities.
              </CardDescription>
            </CardHeader>
          </Card>

          <DrillDownDashboard
            orgId={orgId}
            initialPeriodId={currentPeriod?.id}
            onFilterChange={(filters) => {
              console.log("Filters changed:", filters);
            }}
          />
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection & Analysis</CardTitle>
              <CardDescription>
                Automatically detect statistical outliers, unusual patterns, and data quality issues
                in your emissions records. Critical anomalies indicate potential errors or fraud.
              </CardDescription>
            </CardHeader>
          </Card>

          <AnomalyHighlightingPanel
            orgId={orgId}
            initialPeriodId={currentPeriod?.id}
          />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <CustomReportBuilder
            orgId={orgId}
            onReportGenerated={(url, format) => {
              console.log(`Report generated in ${format} format`);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
