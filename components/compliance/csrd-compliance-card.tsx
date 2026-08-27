"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";
import type { CSRDComplianceMapping, CSRDMilestone } from "@/lib/compliance/csrd-mapper";

interface CSRDComplianceCardProps {
  compliance: CSRDComplianceMapping;
}

export function CSRDComplianceCard({ compliance }: CSRDComplianceCardProps) {
  const statusColor =
    compliance.complianceStatus === "compliant"
      ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900"
      : compliance.complianceStatus === "partial"
        ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900"
        : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900";

  const statusIcon =
    compliance.complianceStatus === "compliant" ? (
      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
    );

  return (
    <div className="space-y-4">
      <Card className={statusColor}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {statusIcon}
              <div>
                <CardTitle>CSRD Compliance Status</CardTitle>
                <CardDescription>EU Corporate Sustainability Reporting Directive</CardDescription>
              </div>
            </div>
            <Badge
              variant={
                compliance.complianceStatus === "compliant"
                  ? "default"
                  : compliance.complianceStatus === "partial"
                    ? "secondary"
                    : "destructive"
              }
            >
              {compliance.complianceStatus.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Emissions Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {compliance.scope1Emissions !== undefined && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Scope 1</p>
                <p className="text-lg font-bold">
                  {(compliance.scope1Emissions / 1000).toFixed(1)} t
                </p>
                <Badge variant="outline" className="text-xs">
                  Direct
                </Badge>
              </div>
            )}

            {compliance.scope2Emissions !== undefined && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Scope 2</p>
                <p className="text-lg font-bold">
                  {(compliance.scope2Emissions / 1000).toFixed(1)} t
                </p>
                <Badge variant="outline" className="text-xs">
                  Energy
                </Badge>
              </div>
            )}

            {compliance.scope3Emissions !== undefined && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Scope 3</p>
                <p className="text-lg font-bold">
                  {(compliance.scope3Emissions / 1000).toFixed(1)} t
                </p>
                <Badge variant="outline" className="text-xs">
                  Indirect
                </Badge>
              </div>
            )}

            {compliance.totalEmissions !== undefined && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-lg font-bold">
                  {(compliance.totalEmissions / 1000).toFixed(1)} t
                </p>
                <Badge className="text-xs">CO₂e</Badge>
              </div>
            )}
          </div>

          {/* Missing Data Alert */}
          {compliance.missingData.length > 0 && (
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="ml-2 text-xs text-orange-800 dark:text-orange-200">
                <p className="font-medium">Missing Data:</p>
                <ul className="mt-1 space-y-1">
                  {compliance.missingData.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Mandatory Requirements */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Mandatory CSRD Requirements
            </h4>
            <div className="space-y-2">
              {compliance.mandatoryRequirements.map((req, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-medium">{req.article}</p>
                    <p className="text-gray-700 dark:text-gray-300">{req.requirement}</p>
                    {req.timeline && (
                      <p className="mt-1 text-gray-500 dark:text-gray-400">{req.timeline}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {compliance.recommendations.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold">Recommendations</h4>
              <ul className="space-y-2">
                {compliance.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-2 text-xs">
                    <span className="flex-shrink-0 pt-0.5">→</span>
                    <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Milestones */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Upcoming Regulatory Deadlines
            </h4>
            <div className="space-y-2">
              {compliance.nextSteps.slice(0, 3).map((milestone) => (
                <CSRDMilestoneRow key={milestone.year} milestone={milestone} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CSRDMilestoneRowProps {
  milestone: CSRDMilestone;
}

function CSRDMilestoneRow({ milestone }: CSRDMilestoneRowProps) {
  const isPast = milestone.status === "completed";

  return (
    <div className={`rounded-lg border p-3 ${isPast ? "bg-gray-50 dark:bg-gray-900" : "bg-white dark:bg-gray-950"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{milestone.deadline}</p>
          <p className={`mt-1 text-sm ${isPast ? "text-gray-600 dark:text-gray-400 line-through" : "font-medium"}`}>
            {milestone.requirement}
          </p>
        </div>
        <Badge variant={isPast ? "secondary" : "default"} className="ml-2 text-xs">
          {milestone.year}
        </Badge>
      </div>
    </div>
  );
}

interface CSRDCategoryMappingProps {
  categoryCode: string;
  categoryName: string;
  csrdMapping: string;
  esaTaxonomy?: string;
  dnshCriteria?: string;
}

export function CSRDCategoryMapping({
  categoryCode,
  categoryName,
  csrdMapping,
  esaTaxonomy,
  dnshCriteria,
}: CSRDCategoryMappingProps) {
  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{categoryName}</CardTitle>
            <CardDescription className="font-mono text-xs">{categoryCode}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">CSRD Annex Mapping</p>
          <p className="mt-1 text-sm font-mono">{csrdMapping}</p>
        </div>

        {esaTaxonomy && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              EU Sustainability Taxonomy
            </p>
            <p className="mt-1 text-sm">{esaTaxonomy}</p>
          </div>
        )}

        {dnshCriteria && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">DNSH Criteria</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{dnshCriteria}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
