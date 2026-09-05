"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronRight, Download, FileText, AlertCircle } from "lucide-react";

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface CalculationDetail {
  id: string;
  totalCo2e: number;
  formula: string;
  factorValue: number | null;
  normalizedAmount: number;
  normalizedUnit: string;
  selectionReason: string | null;
  dataQualityScore: number;
  activityRecord: ActivityRecordDetail;
}

interface ActivityRecordDetail {
  id: string;
  amount: number;
  unit: string;
  sourceDescription: string | null;
  createdAt: Date;
  importBatch?: {
    id: string;
    sourceFilename: string;
    createdAt: Date;
    createdBy?: { name: string | null; email: string } | null;
  } | null;
  fieldSubmissionId?: string | null;
  fieldSubmissionDocumentType?: string;
  fieldSubmissionCreatedAt?: Date;
  submittedByName?: string | null;
  submittedByEmail?: string;
  evidence: Array<{ id: string; filename: string; mimeType: string }>;
}

interface AggregateDetail {
  id: string;
  scope: number;
  totalCo2e: number;
  recordCount: number;
  emissionCategory?: { id: string; name: string; code: string } | null;
  facility?: { id: string; name: string } | null;
  calculations: CalculationDetail[];
}

interface LineageResponse {
  aggregates: AggregateDetail[];
  count: number;
}

export default function LineagePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const snapshotId = searchParams.get("snapshotId");
  const reportingPeriodId = searchParams.get("reportingPeriodId");

  const [lineageData, setLineageData] = useState<LineageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAggregate, setSelectedAggregate] =
    useState<AggregateDetail | null>(null);
  const [selectedCalculation, setSelectedCalculation] =
    useState<CalculationDetail | null>(null);

  useEffect(() => {
    const fetchLineage = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (snapshotId) params.append("snapshotId", snapshotId);
        if (reportingPeriodId)
          params.append("reportingPeriodId", reportingPeriodId);

        const res = await fetch(
          `/api/orgs/${orgId}/lineage?${params.toString()}`,
        );
        if (!res.ok) {
          throw new Error("Failed to fetch lineage data");
        }

        const data: LineageResponse = await res.json();
        setLineageData(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An error occurred loading lineage",
        );
      } finally {
        setLoading(false);
      }
    };

    if (orgId && (snapshotId || reportingPeriodId)) {
      fetchLineage();
    }
  }, [orgId, snapshotId, reportingPeriodId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-gray-600">Loading lineage data...</p>
        </div>
      </div>
    );
  }

  if (error || !lineageData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-600" />
          <p className="text-red-900">
            {error || "No lineage data available"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Lineage</h1>
          <p className="mt-2 text-gray-600">
            Trace emissions calculations back to source records and evidence
          </p>
        </div>

        {lineageData.count === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">No emissions data found for this period</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {lineageData.aggregates.map((aggregate) => (
              <AggregateCard
                key={aggregate.id}
                aggregate={aggregate}
                onSelect={() => setSelectedAggregate(aggregate)}
              />
            ))}
          </div>
        )}

        {selectedAggregate && (
          <AggregateModal
            aggregate={selectedAggregate}
            onClose={() => setSelectedAggregate(null)}
            onSelectCalculation={(calc) => {
              setSelectedCalculation(calc);
              setSelectedAggregate(null);
            }}
          />
        )}

        {selectedCalculation && (
          <CalculationModal
            calculation={selectedCalculation}
            onClose={() => setSelectedCalculation(null)}
          />
        )}
      </div>
    </div>
  );
}

interface AggregateCardProps {
  aggregate: AggregateDetail;
  onSelect: () => void;
}

function AggregateCard({ aggregate, onSelect }: AggregateCardProps) {
  return (
    <button
      onClick={onSelect}
      className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
              Scope {aggregate.scope}
            </span>
            {aggregate.emissionCategory && (
              <span className="text-sm font-medium text-gray-700">
                {aggregate.emissionCategory.name}
              </span>
            )}
          </div>
          {aggregate.facility && (
            <p className="mt-1 text-sm text-gray-600">
              {aggregate.facility.name}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {aggregate.totalCo2e.toFixed(2)}
          </div>
          <p className="text-sm text-gray-500">tCO2e</p>
          <p className="mt-1 text-xs text-gray-500">
            {aggregate.recordCount} {aggregate.recordCount === 1 ? "record" : "records"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center text-sm text-blue-600">
        View calculations <ChevronRight className="ml-1 h-4 w-4" />
      </div>
    </button>
  );
}

interface AggregateModalProps {
  aggregate: AggregateDetail;
  onClose: () => void;
  onSelectCalculation: (calc: CalculationDetail) => void;
}

function AggregateModal({
  aggregate,
  onClose,
  onSelectCalculation,
}: AggregateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Calculations</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500">CATEGORY</p>
              <p className="text-sm font-medium text-gray-900">
                {aggregate.emissionCategory?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">TOTAL CO2E</p>
              <p className="text-sm font-medium text-gray-900">
                {aggregate.totalCo2e.toFixed(2)} tCO2e
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {aggregate.calculations.map((calc) => (
            <button
              key={calc.id}
              onClick={() => onSelectCalculation(calc)}
              className="w-full rounded border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {calc.totalCo2e.toFixed(4)} tCO2e
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {calc.normalizedAmount.toFixed(2)} {calc.normalizedUnit}
                  </p>
                  {calc.selectionReason && (
                    <p className="mt-1 text-xs text-gray-600">
                      {calc.selectionReason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-600">
                    Quality: {calc.dataQualityScore}%
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-gray-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CalculationModalProps {
  calculation: CalculationDetail;
  onClose: () => void;
}

function CalculationModal({ calculation, onClose }: CalculationModalProps) {
  const rec = calculation.activityRecord;
  const sourceType = rec.importBatch
    ? "Import"
    : rec.fieldSubmissionId
      ? "Field Submission"
      : "Manual Entry";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Calculation Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              CALCULATION RESULT
            </h3>
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-500">TOTAL CO2E</p>
                <p className="text-lg font-bold text-gray-900">
                  {calculation.totalCo2e.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">NORMALIZED AMOUNT</p>
                <p className="text-sm font-medium text-gray-900">
                  {calculation.normalizedAmount.toFixed(2)}{" "}
                  {calculation.normalizedUnit}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">QUALITY SCORE</p>
                <p className="text-sm font-medium text-gray-900">
                  {calculation.dataQualityScore}%
                </p>
              </div>
            </div>
            <div className="mt-3 rounded bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-900">FORMULA</p>
              <code className="mt-1 block break-all font-mono text-xs text-blue-800">
                {calculation.formula}
              </code>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              SOURCE ACTIVITY
            </h3>
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">AMOUNT</p>
                  <p className="text-sm font-medium text-gray-900">
                    {rec.amount} {rec.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500">SOURCE</p>
                  <p className="text-sm font-medium text-gray-900">{sourceType}</p>
                </div>
              </div>
              {rec.sourceDescription && (
                <div>
                  <p className="text-xs font-medium text-gray-500">DESCRIPTION</p>
                  <p className="mt-1 text-sm text-gray-700">
                    {rec.sourceDescription}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500">RECORDED</p>
                <p className="text-xs text-gray-600">
                  {formatDate(rec.createdAt)}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              LINEAGE ORIGIN
            </h3>
            {rec.importBatch ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {rec.importBatch.sourceFilename}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Imported {formatDate(rec.importBatch.createdAt)}
                    </p>
                    {rec.importBatch.createdBy && (
                      <p className="mt-1 text-xs text-gray-600">
                        by {rec.importBatch.createdBy.name || rec.importBatch.createdBy.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : rec.fieldSubmissionId ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {rec.fieldSubmissionDocumentType || "Field Submission"}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Submitted by{" "}
                      {rec.submittedByName || rec.submittedByEmail}
                    </p>
                    {rec.fieldSubmissionCreatedAt && (
                      <p className="text-xs text-gray-600">
                        {formatDate(rec.fieldSubmissionCreatedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600">Manual entry</p>
              </div>
            )}
          </section>

          {rec.evidence.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                EVIDENCE FILES ({rec.evidence.length})
              </h3>
              <div className="space-y-2">
                {rec.evidence.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded border border-gray-200 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {file.filename}
                        </p>
                        <p className="text-xs text-gray-500">{file.mimeType}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
