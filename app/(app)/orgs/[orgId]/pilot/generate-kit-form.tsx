"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/forms/form-kit";

interface FormData {
  organizationName: string;
  industry: string;
  facilityCount: string;
  facilityNames: string;
  accountingSystem: string;
  sustainabilityLeadName: string;
  sustainabilityLeadEmail: string;
  sustainabilityLeadRole: string;
  financeLeadName: string;
  financeLeadEmail: string;
  financeLeadRole: string;
  itAdminName: string;
  itAdminEmail: string;
  externalAuditorName: string;
  externalAuditorFirm: string;
  externalAuditorEmail: string;
  csrdFramework: boolean;
  sbtiFramework: boolean;
  cdpFramework: boolean;
  ghgProtocolFramework: boolean;
  timelineDays: string;
  pilotStartDate: string;
  supplierCount: string;
  fieldWorkerCount: string;
  reportingCurrency: string;
  timezone: string;
}

interface GenerateKitFormProps {
  orgId: string;
  organizationName: string;
}

export function GenerateKitForm({ orgId, organizationName }: GenerateKitFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    organizationName,
    industry: "",
    facilityCount: "1",
    facilityNames: "",
    accountingSystem: "",
    sustainabilityLeadName: "",
    sustainabilityLeadEmail: "",
    sustainabilityLeadRole: "",
    financeLeadName: "",
    financeLeadEmail: "",
    financeLeadRole: "",
    itAdminName: "",
    itAdminEmail: "",
    externalAuditorName: "",
    externalAuditorFirm: "",
    externalAuditorEmail: "",
    csrdFramework: false,
    sbtiFramework: false,
    cdpFramework: false,
    ghgProtocolFramework: true,
    timelineDays: "90",
    pilotStartDate: "",
    supplierCount: "0",
    fieldWorkerCount: "0",
    reportingCurrency: "GBP",
    timezone: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string | boolean } }
  ) => {
    const { name, value } = e.target as HTMLInputElement & { name: string; value: string | boolean };
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Client-side validation for critical fields
      if (!formData.industry) {
        throw new Error("Please select an industry");
      }
      if (!formData.facilityNames.trim()) {
        throw new Error("Please enter at least one facility name");
      }
      if (!formData.sustainabilityLeadName || !formData.sustainabilityLeadEmail) {
        throw new Error("Please provide sustainability lead information");
      }
      if (!formData.financeLeadName || !formData.financeLeadEmail) {
        throw new Error("Please provide finance lead information");
      }
      if (!formData.itAdminName || !formData.itAdminEmail) {
        throw new Error("Please provide IT admin information");
      }
      if (!formData.pilotStartDate) {
        throw new Error("Please select a pilot start date");
      }
      if (!formData.timezone) {
        throw new Error("Please select a timezone");
      }

      const selectedFrameworks: string[] = [];
      if (formData.csrdFramework) selectedFrameworks.push("CSRD");
      if (formData.sbtiFramework) selectedFrameworks.push("SBTi");
      if (formData.cdpFramework) selectedFrameworks.push("CDP");
      if (formData.ghgProtocolFramework) selectedFrameworks.push("GHG-Protocol");

      if (selectedFrameworks.length === 0) {
        throw new Error("Please select at least one compliance framework");
      }

      const facilityNames = formData.facilityNames
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const payload = {
        organizationId: orgId,
        organizationName: formData.organizationName,
        industry: formData.industry,
        facilityCount: parseInt(formData.facilityCount, 10),
        facilityNames,
        accountingSystem: formData.accountingSystem || undefined,
        stakeholders: {
          sustainabilityLead: {
            name: formData.sustainabilityLeadName,
            email: formData.sustainabilityLeadEmail,
            role: formData.sustainabilityLeadRole,
          },
          financeLead: {
            name: formData.financeLeadName,
            email: formData.financeLeadEmail,
            role: formData.financeLeadRole,
          },
          itAdmin: {
            name: formData.itAdminName,
            email: formData.itAdminEmail,
          },
          ...(formData.externalAuditorEmail && {
            externalAuditor: {
              name: formData.externalAuditorName || "External Auditor",
              firm: formData.externalAuditorFirm || "TBD",
              email: formData.externalAuditorEmail,
            },
          }),
        },
        complianceFrameworks: selectedFrameworks,
        timelineDays: parseInt(formData.timelineDays, 10),
        pilotStartDate: new Date(formData.pilotStartDate).toISOString(),
        supplierCount: parseInt(formData.supplierCount, 10),
        fieldWorkerCount: parseInt(formData.fieldWorkerCount, 10),
        reportingCurrency: formData.reportingCurrency,
        timezone: formData.timezone,
      };

      const response = await fetch(`/api/orgs/${orgId}/pilot/generate-kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate pilot kit");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {success && (
        <Alert className="border-green-200 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <AlertDescription className="text-green-800">
              Pilot documentation kit generated successfully! Your guides are ready on the dashboard.
            </AlertDescription>
          </div>
          <Link href={`/orgs/${orgId}/dashboard`}>
            <Button variant="outline" size="sm" className="border-green-300 hover:bg-green-100">
              View on Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </Alert>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organization Section */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Organization Name" htmlFor="organizationName">
                <Input
                  id="organizationName"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="Your Company Inc."
                />
              </FormField>

              <FormField label="Industry" htmlFor="industry">
                <Select value={formData.industry} onValueChange={(value) => handleChange({ target: { name: "industry", value } })}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Logistics">Logistics & Transportation</SelectItem>
                    <SelectItem value="Retail">Retail & Distribution</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Construction">Construction</SelectItem>
                    <SelectItem value="Waste Management">Waste Management</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Number of Facilities" htmlFor="facilityCount">
                <Input
                  id="facilityCount"
                  name="facilityCount"
                  type="number"
                  min="1"
                  value={formData.facilityCount}
                  onChange={handleChange}
                  placeholder="1"
                />
              </FormField>

              <FormField label="Facility Names (comma-separated)" htmlFor="facilityNames" hint="Enter facility names separated by commas">
                <Input
                  id="facilityNames"
                  name="facilityNames"
                  value={formData.facilityNames}
                  onChange={handleChange}
                  placeholder="London Warehouse, Manchester Distribution Center"
                />
              </FormField>

              <FormField label="Accounting System" htmlFor="accountingSystem" optional>
                <Select value={formData.accountingSystem || "none"} onValueChange={(value) => handleChange({ target: { name: "accountingSystem", value: value === "none" ? "" : value } })}>
                  <SelectTrigger id="accountingSystem">
                    <SelectValue placeholder="Select or leave blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not using integrated accounting</SelectItem>
                    <SelectItem value="Xero">Xero</SelectItem>
                    <SelectItem value="QuickBooks">QuickBooks</SelectItem>
                    <SelectItem value="SAP">SAP</SelectItem>
                    <SelectItem value="NetSuite">NetSuite</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </CardContent>
          </Card>

          {/* Stakeholders Section */}
          <Card>
            <CardHeader>
              <CardTitle>Key Stakeholders</CardTitle>
              <CardDescription>Primary contacts for pilot program</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sustainability Lead */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="font-semibold">Sustainability Lead</h3>
                <FormField label="Name" htmlFor="sustainabilityLeadName" optional>
                  <Input
                    id="sustainabilityLeadName"
                    name="sustainabilityLeadName"
                    value={formData.sustainabilityLeadName}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                  />
                </FormField>
                <FormField label="Email" htmlFor="sustainabilityLeadEmail" optional>
                  <Input
                    id="sustainabilityLeadEmail"
                    name="sustainabilityLeadEmail"
                    type="email"
                    value={formData.sustainabilityLeadEmail}
                    onChange={handleChange}
                    placeholder="jane@company.com"
                  />
                </FormField>
                <FormField label="Job Title" htmlFor="sustainabilityLeadRole">
                  <Input
                    id="sustainabilityLeadRole"
                    name="sustainabilityLeadRole"
                    value={formData.sustainabilityLeadRole}
                    onChange={handleChange}
                    placeholder="Head of Sustainability"
                  />
                </FormField>
              </div>

              {/* Finance Lead */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="font-semibold">Finance Lead</h3>
                <FormField label="Name" htmlFor="financeLeadName" optional>
                  <Input
                    id="financeLeadName"
                    name="financeLeadName"
                    value={formData.financeLeadName}
                    onChange={handleChange}
                    placeholder="John Doe"
                  />
                </FormField>
                <FormField label="Email" htmlFor="financeLeadEmail" optional>
                  <Input
                    id="financeLeadEmail"
                    name="financeLeadEmail"
                    type="email"
                    value={formData.financeLeadEmail}
                    onChange={handleChange}
                    placeholder="john@company.com"
                  />
                </FormField>
                <FormField label="Job Title" htmlFor="financeLeadRole">
                  <Input
                    id="financeLeadRole"
                    name="financeLeadRole"
                    value={formData.financeLeadRole}
                    onChange={handleChange}
                    placeholder="CFO"
                  />
                </FormField>
              </div>

              {/* IT Admin */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="font-semibold">IT Administrator</h3>
                <FormField label="Name" htmlFor="itAdminName" optional>
                  <Input
                    id="itAdminName"
                    name="itAdminName"
                    value={formData.itAdminName}
                    onChange={handleChange}
                    placeholder="Alice Johnson"
                  />
                </FormField>
                <FormField label="Email" htmlFor="itAdminEmail" optional>
                  <Input
                    id="itAdminEmail"
                    name="itAdminEmail"
                    type="email"
                    value={formData.itAdminEmail}
                    onChange={handleChange}
                    placeholder="alice@company.com"
                  />
                </FormField>
              </div>

              {/* External Auditor (Optional) */}
              <div className="space-y-4">
                <h3 className="font-semibold">External Auditor (Optional)</h3>
                <FormField label="Name" htmlFor="externalAuditorName" optional>
                  <Input
                    id="externalAuditorName"
                    name="externalAuditorName"
                    value={formData.externalAuditorName}
                    onChange={handleChange}
                    placeholder="Robert Williams"
                  />
                </FormField>
                <FormField label="Firm" htmlFor="externalAuditorFirm">
                  <Input
                    id="externalAuditorFirm"
                    name="externalAuditorFirm"
                    value={formData.externalAuditorFirm}
                    onChange={handleChange}
                    placeholder="Audit & Compliance Ltd."
                  />
                </FormField>
                <FormField label="Email" htmlFor="externalAuditorEmail" optional>
                  <Input
                    id="externalAuditorEmail"
                    name="externalAuditorEmail"
                    type="email"
                    value={formData.externalAuditorEmail}
                    onChange={handleChange}
                    placeholder="robert@auditfirm.com"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Frameworks */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Frameworks</CardTitle>
              <CardDescription>Select applicable frameworks for your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="csrdFramework"
                  checked={formData.csrdFramework}
                  onCheckedChange={(checked) => handleCheckboxChange("csrdFramework", checked as boolean)}
                />
                <Label htmlFor="csrdFramework" className="font-normal cursor-pointer">
                  CSRD (Corporate Sustainability Reporting Directive)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sbtiFramework"
                  checked={formData.sbtiFramework}
                  onCheckedChange={(checked) => handleCheckboxChange("sbtiFramework", checked as boolean)}
                />
                <Label htmlFor="sbtiFramework" className="font-normal cursor-pointer">
                  SBTi (Science Based Targets initiative)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cdpFramework"
                  checked={formData.cdpFramework}
                  onCheckedChange={(checked) => handleCheckboxChange("cdpFramework", checked as boolean)}
                />
                <Label htmlFor="cdpFramework" className="font-normal cursor-pointer">
                  CDP (Climate Disclosure Project)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ghgProtocolFramework"
                  checked={formData.ghgProtocolFramework}
                  onCheckedChange={(checked) => handleCheckboxChange("ghgProtocolFramework", checked as boolean)}
                />
                <Label htmlFor="ghgProtocolFramework" className="font-normal cursor-pointer">
                  GHG Protocol (Greenhouse Gas Protocol)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Timeline & Operations */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline & Operations</CardTitle>
              <CardDescription>Pilot program details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Pilot Duration (Days)" htmlFor="timelineDays" hint="Typically 30-365 days">
                <Input
                  id="timelineDays"
                  name="timelineDays"
                  type="number"
                  min="30"
                  max="365"
                  value={formData.timelineDays}
                  onChange={handleChange}
                  placeholder="90"
                />
              </FormField>

              <FormField label="Pilot Start Date" htmlFor="pilotStartDate">
                <Input
                  id="pilotStartDate"
                  name="pilotStartDate"
                  type="date"
                  value={formData.pilotStartDate}
                  onChange={handleChange}
                />
              </FormField>

              <FormField label="Number of Suppliers" htmlFor="supplierCount" hint="For Scope 3 collaboration">
                <Input
                  id="supplierCount"
                  name="supplierCount"
                  type="number"
                  min="0"
                  value={formData.supplierCount}
                  onChange={handleChange}
                  placeholder="0"
                />
              </FormField>

              <FormField label="Number of Field Workers" htmlFor="fieldWorkerCount" hint="Using mobile app for data capture">
                <Input
                  id="fieldWorkerCount"
                  name="fieldWorkerCount"
                  type="number"
                  min="0"
                  value={formData.fieldWorkerCount}
                  onChange={handleChange}
                  placeholder="0"
                />
              </FormField>

              <FormField label="Reporting Currency" htmlFor="reportingCurrency">
                <Select value={formData.reportingCurrency} onValueChange={(value) => handleChange({ target: { name: "reportingCurrency", value } })}>
                  <SelectTrigger id="reportingCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="AUD">AUD (Australian Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Timezone" htmlFor="timezone">
                <Select value={formData.timezone} onValueChange={(value) => handleChange({ target: { name: "timezone", value } })}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                    <SelectItem value="America/New_York">
                      America/New_York (EST/EDT)
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      America/Los_Angeles (PST/PDT)
                    </SelectItem>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Generating..." : "Generate Documentation Kit"}
            </Button>
          </div>
        </form>
    </div>
  );
}
