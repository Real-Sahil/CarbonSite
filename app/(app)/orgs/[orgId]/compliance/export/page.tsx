"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceExportModal } from "@/components/compliance/evidence-export-modal";
import { AlertCircle, CheckCircle2, Download, ShieldCheck, Clock, Users, FileText } from "lucide-react";

export default function EvidenceExportPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(""), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Evidence Export</h1>
        <p className="text-gray-600 mt-2">
          Generate audit trails and evidence packages for regulatory compliance frameworks
        </p>
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Quick Export Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Generate Compliance Evidence Package
              </CardTitle>
              <CardDescription>
                Create a complete audit trail and evidence package for regulators
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Start Export
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Features Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Complete Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Full record of all actions, calculations, and data changes with timestamps and actor information
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Verified Data Lineage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Complete traceability from source documents through calculations to published reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
              Framework Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Evidence packages mapped to specific regulatory frameworks (CSRD, SBTi, CDP, GHG Protocol, ISO 14064)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* What's Included Section */}
      <Card>
        <CardHeader>
          <CardTitle>What's Included in Your Evidence Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Audit Information</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Complete action audit trail (50+ event types)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Actor identification and timestamp records</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>IP addresses and session information</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Cryptographic hash chain for tamper detection</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Calculation Evidence</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Emission factor library versions and selections</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Calculation formulas for each record</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>GHG Protocol methodology compliance proof</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Data quality checks and validation results</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Data Integrity</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Data lineage from source to published output</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Immutable snapshot records with checksums</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Digital signatures for verification</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Tamper detection via hash chains</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Compliance Mapping</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Framework-specific requirement mapping</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Scope 1, 2, and 3 breakdowns</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Calculation methodology documentation</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-606">✓</span>
                  <span>Third-party factor source verification</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Use Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Common Use Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <h3 className="font-medium text-sm">Regulatory Audits</h3>
              </div>
              <p className="text-xs text-gray-600">
                Provide complete evidence packages to regulators during compliance audits
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-medium text-sm">Third-Party Verification</h3>
              </div>
              <p className="text-xs text-gray-600">
                Share audit trails with external auditors and verification bodies
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <h3 className="font-medium text-sm">Framework Disclosure</h3>
              </div>
              <p className="text-xs text-gray-600">
                Generate framework-specific evidence for CSRD, SBTi, CDP reporting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> All evidence packages are generated on-demand and include only data from the date range you specify. Each export includes a verification timestamp and digital signature. Your organization's data remains completely private and secure.
          </p>
        </CardContent>
      </Card>

      {/* Export Modal */}
      <EvidenceExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orgId={orgId}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
}
