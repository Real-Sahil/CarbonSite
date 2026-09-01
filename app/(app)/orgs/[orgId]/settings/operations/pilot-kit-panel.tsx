'use client';

import { useState, useTransition } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FRAMEWORKS = ['CSRD', 'SBTi', 'CDP', 'GHG-Protocol'] as const;

interface PilotKitPanelProps {
  orgId: string;
  orgName: string;
  industry?: string;
  reportingCurrency?: string;
}

export function PilotKitPanel({
  orgId,
  orgName,
  industry = '',
  reportingCurrency = 'GBP',
}: PilotKitPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Form state
  const [facilityCount, setFacilityCount] = useState('1');
  const [facilityNames, setFacilityNames] = useState('Main Facility');
  const [supplierCount, setSupplierCount] = useState('5');
  const [fieldWorkerCount, setFieldWorkerCount] = useState('0');
  const [timelineDays, setTimelineDays] = useState('90');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['CSRD', 'GHG-Protocol']);

  // Stakeholder form state
  const [sustainabilityLeadName, setSustainabilityLeadName] = useState('');
  const [sustainabilityLeadEmail, setSustainabilityLeadEmail] = useState('');
  const [sustainabilityLeadRole, setSustainabilityLeadRole] = useState('Sustainability Manager');

  const [financeLeadName, setFinanceLeadName] = useState('');
  const [financeLeadEmail, setFinanceLeadEmail] = useState('');
  const [financeLeadRole, setFinanceLeadRole] = useState('Finance Lead');

  const [itAdminName, setItAdminName] = useState('');
  const [itAdminEmail, setItAdminEmail] = useState('');

  const [auditorName, setAuditorName] = useState('');
  const [auditorFirm, setAuditorFirm] = useState('');
  const [auditorEmail, setAuditorEmail] = useState('');

  function toggleFramework(framework: string) {
    setSelectedFrameworks((prev) =>
      prev.includes(framework)
        ? prev.filter((f) => f !== framework)
        : [...prev, framework]
    );
  }

  function generateKit() {
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!facilityNames.trim()) {
      setError('Please enter at least one facility name');
      return;
    }
    if (!sustainabilityLeadName.trim() || !sustainabilityLeadEmail.trim()) {
      setError('Please provide sustainability lead details');
      return;
    }
    if (!financeLeadName.trim() || !financeLeadEmail.trim()) {
      setError('Please provide finance lead details');
      return;
    }
    if (!itAdminName.trim() || !itAdminEmail.trim()) {
      setError('Please provide IT admin details');
      return;
    }
    if (selectedFrameworks.length === 0) {
      setError('Please select at least one compliance framework');
      return;
    }

    const facilityNamesList = facilityNames
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const payload = {
      organizationId: orgId,
      organizationName: orgName || 'Organization',
      industry: industry || 'General',
      facilityCount: parseInt(facilityCount, 10) || 1,
      facilityNames: facilityNamesList,
      stakeholders: {
        sustainabilityLead: {
          name: sustainabilityLeadName.trim(),
          email: sustainabilityLeadEmail.trim(),
          role: sustainabilityLeadRole.trim(),
        },
        financeLead: {
          name: financeLeadName.trim(),
          email: financeLeadEmail.trim(),
          role: financeLeadRole.trim(),
        },
        itAdmin: {
          name: itAdminName.trim(),
          email: itAdminEmail.trim(),
        },
        ...(auditorName.trim() && {
          externalAuditor: {
            name: auditorName.trim(),
            firm: auditorFirm.trim(),
            email: auditorEmail.trim(),
          },
        }),
      },
      complianceFrameworks: selectedFrameworks,
      timelineDays: parseInt(timelineDays, 10) || 90,
      pilotStartDate: new Date().toISOString(),
      supplierCount: parseInt(supplierCount, 10) || 0,
      fieldWorkerCount: parseInt(fieldWorkerCount, 10) || 0,
      reportingCurrency: reportingCurrency || 'GBP',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/pilot/generate-kit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `Failed to generate kit (${res.status})`);
        }

        const result = await res.json();
        setSuccess(`Pilot kit generated successfully at ${new Date().toLocaleTimeString()}`);
        setGeneratedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate pilot kit');
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PanelHeader
        title="Pilot Client Documentation Kit"
        description="Generate comprehensive onboarding documentation for pilot clients including stakeholder guides, integration instructions, and compliance frameworks."
      />

      <div className="border-t border-slate-100 p-4 space-y-6">
        {/* Organization & Facility Info */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Organization & Facilities</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Number of facilities">
              <Input
                type="number"
                value={facilityCount}
                onChange={(e) => setFacilityCount(e.target.value)}
                disabled={isPending}
                min="1"
                max="100"
              />
            </Field>
            <Field label="Facility names (comma-separated)">
              <Input
                value={facilityNames}
                onChange={(e) => setFacilityNames(e.target.value)}
                disabled={isPending}
                placeholder="e.g. Main Site, Warehouse, Distribution Center"
              />
            </Field>
          </div>
        </div>

        {/* Stakeholders */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Key Stakeholders</h3>

          {/* Sustainability Lead */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
            <p className="font-medium text-sm text-slate-700">Sustainability Lead</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Name">
                <Input
                  value={sustainabilityLeadName}
                  onChange={(e) => setSustainabilityLeadName(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Sarah Johnson"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={sustainabilityLeadEmail}
                  onChange={(e) => setSustainabilityLeadEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="sarah@company.com"
                />
              </Field>
              <Field label="Role">
                <Input
                  value={sustainabilityLeadRole}
                  onChange={(e) => setSustainabilityLeadRole(e.target.value)}
                  disabled={isPending}
                  placeholder="Sustainability Manager"
                />
              </Field>
            </div>
          </div>

          {/* Finance Lead */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
            <p className="font-medium text-sm text-slate-700">Finance Lead</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Name">
                <Input
                  value={financeLeadName}
                  onChange={(e) => setFinanceLeadName(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Michael Chen"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={financeLeadEmail}
                  onChange={(e) => setFinanceLeadEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="michael@company.com"
                />
              </Field>
              <Field label="Role">
                <Input
                  value={financeLeadRole}
                  onChange={(e) => setFinanceLeadRole(e.target.value)}
                  disabled={isPending}
                  placeholder="Finance Lead"
                />
              </Field>
            </div>
          </div>

          {/* IT Admin */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
            <p className="font-medium text-sm text-slate-700">IT Administrator</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Name">
                <Input
                  value={itAdminName}
                  onChange={(e) => setItAdminName(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. David Smith"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={itAdminEmail}
                  onChange={(e) => setItAdminEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="david@company.com"
                />
              </Field>
            </div>
          </div>

          {/* External Auditor (Optional) */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
            <p className="font-medium text-sm text-slate-700">External Auditor (Optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Name">
                <Input
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Emma Williams"
                />
              </Field>
              <Field label="Firm">
                <Input
                  value={auditorFirm}
                  onChange={(e) => setAuditorFirm(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Audit Associates"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={auditorEmail}
                  onChange={(e) => setAuditorEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="emma@auditors.com"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Project Settings */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Project Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pilot timeline (days)">
              <Input
                type="number"
                value={timelineDays}
                onChange={(e) => setTimelineDays(e.target.value)}
                disabled={isPending}
                min="30"
                max="365"
              />
            </Field>
            <Field label="Suppliers">
              <Input
                type="number"
                value={supplierCount}
                onChange={(e) => setSupplierCount(e.target.value)}
                disabled={isPending}
                min="0"
              />
            </Field>
            <Field label="Field workers">
              <Input
                type="number"
                value={fieldWorkerCount}
                onChange={(e) => setFieldWorkerCount(e.target.value)}
                disabled={isPending}
                min="0"
              />
            </Field>
          </div>
        </div>

        {/* Compliance Frameworks */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Compliance Frameworks</h3>
          <div className="flex flex-wrap gap-3">
            {FRAMEWORKS.map((framework) => (
              <label key={framework} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFrameworks.includes(framework)}
                  onChange={() => toggleFramework(framework)}
                  disabled={isPending}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">{framework}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 p-3 rounded">{success}</p>}
      </div>

      {/* Action */}
      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
        <Button
          onClick={generateKit}
          disabled={isPending}
          className="flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Generate Pilot Kit
            </>
          )}
        </Button>
        {generatedAt && (
          <p className="text-xs text-slate-500">
            Last generated: {new Date(generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-4 border-b border-slate-200">
      <h2 className="font-semibold text-slate-900 text-base">{title}</h2>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
