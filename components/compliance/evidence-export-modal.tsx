"use client";

import { useState } from "react";
import { Download, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EvidenceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const FRAMEWORKS = [
  { id: "csrd", label: "CSRD (Corporate Sustainability Reporting Directive)", description: "EU sustainability reporting standard" },
  { id: "sbti", label: "SBTi (Science Based Targets initiative)", description: "Science-based emissions reduction targets" },
  { id: "cdp", label: "CDP Climate Disclosure", description: "Environmental disclosures for investors" },
  { id: "ghg-protocol", label: "GHG Protocol", description: "International accounting standard" },
  { id: "iso-14064", label: "ISO 14064-1", description: "Organisational GHG quantification" },
];

export function EvidenceExportModal({
  isOpen,
  onClose,
  orgId,
  onSuccess,
  onError,
}: EvidenceExportModalProps) {
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleFrameworkToggle = (frameworkId: string) => {
    const newFrameworks = new Set(selectedFrameworks);
    if (newFrameworks.has(frameworkId)) {
      newFrameworks.delete(frameworkId);
    } else {
      newFrameworks.add(frameworkId);
    }
    setSelectedFrameworks(newFrameworks);
  };

  const handleSelectAll = () => {
    if (selectedFrameworks.size === FRAMEWORKS.length) {
      setSelectedFrameworks(new Set());
    } else {
      setSelectedFrameworks(new Set(FRAMEWORKS.map(f => f.id)));
    }
  };

  const handleExport = async () => {
    if (selectedFrameworks.size === 0) {
      setStatusMessage("Please select at least one framework");
      return;
    }

    setIsExporting(true);
    setExportStatus("loading");
    setStatusMessage("Generating compliance evidence package...");

    try {
      const params = new URLSearchParams({
        frameworks: Array.from(selectedFrameworks).join(","),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(
        `/api/orgs/${orgId}/audit-logs/export/compliance?${params}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/pdf",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: "Failed to generate evidence package",
        }));
        throw new Error(error.message || "Export failed");
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compliance-evidence-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      setStatusMessage("Compliance evidence package downloaded successfully");
      onSuccess?.("Evidence package exported successfully");

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        setExportStatus("idle");
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setExportStatus("error");
      setStatusMessage(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Compliance Evidence</DialogTitle>
          <DialogDescription>
            Generate an audit trail and evidence package for regulatory frameworks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Reporting Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, startDate: e.target.value })
                  }
                  disabled={isExporting}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, endDate: e.target.value })
                  }
                  disabled={isExporting}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Framework Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Regulatory Frameworks</h3>
              <button
                onClick={handleSelectAll}
                disabled={isExporting}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {selectedFrameworks.size === FRAMEWORKS.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            <div className="grid gap-3">
              {FRAMEWORKS.map((framework) => (
                <label
                  key={framework.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedFrameworks.has(framework.id)}
                    onChange={() => handleFrameworkToggle(framework.id)}
                    disabled={isExporting}
                    className="rounded w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {framework.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {framework.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* What's Included */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                What's Included
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1 text-gray-700">
              <p>✓ Complete audit trail (actions, actors, timestamps, IP addresses)</p>
              <p>✓ Calculation formulas and methodology</p>
              <p>✓ Emission factors used and their sources</p>
              <p>✓ Data lineage from source to published report</p>
              <p>✓ Verification checksums and signatures</p>
              <p>✓ Framework-specific compliance mapping</p>
            </CardContent>
          </Card>

          {/* Status Message */}
          {exportStatus !== "idle" && (
            <div
              className={`p-3 rounded-lg flex items-start gap-3 ${
                exportStatus === "success"
                  ? "bg-green-50 border border-green-200"
                  : exportStatus === "error"
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-200"
              }`}
            >
              {exportStatus === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              ) : exportStatus === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  exportStatus === "success"
                    ? "text-green-700"
                    : exportStatus === "error"
                      ? "text-red-700"
                      : "text-blue-700"
                }`}
              >
                {statusMessage}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedFrameworks.size === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Generating..." : "Export Evidence"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
