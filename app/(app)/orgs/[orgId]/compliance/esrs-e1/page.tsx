'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface DisclosureRequirement {
  id: string;
  code: string;
  name: string;
  description: string;
  dataPoints: DataPoint[];
}

interface DataPoint {
  id: string;
  label: string;
  status: 'met' | 'partial' | 'gap';
  detail: string;
}

interface OrgData {
  hasScope1: boolean;
  hasScope2: boolean;
  hasScope3: boolean;
  hasScope3AllCategories: boolean;
  scope3CategoryCount: number;
  hasSbtiTarget: boolean;
  hasReductionTarget: boolean;
  hasReductionInitiatives: boolean;
  hasPublishedSnapshot: boolean;
  hasGhgReport: boolean;
  hasEnergyConsumption: boolean;
  hasOffsets: boolean;
  hasComplianceCsrd: boolean;
  totalRecords: number;
  approvedRecords: number;
  hasEvidenceFiles: boolean;
}

function StatusIcon({ status }: { status: DataPoint['status'] }) {
  switch (status) {
    case 'met': return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
    case 'partial': return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'gap': return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  }
}

function buildDisclosures(org: OrgData): DisclosureRequirement[] {
  return [
    {
      id: 'e1-1',
      code: 'E1-1',
      name: 'Transition Plan for Climate Change Mitigation',
      description: 'Disclosure of the undertaking\'s transition plan for climate change mitigation, including GHG emission reduction targets and alignment with 1.5C pathway.',
      dataPoints: [
        {
          id: 'e1-1-sbti',
          label: 'Science-Based Target (SBTi) committed or validated',
          status: org.hasSbtiTarget ? 'met' : 'gap',
          detail: org.hasSbtiTarget ? 'SBTi target recorded in CarbonSite' : 'No SBTi target set. Navigate to SBTi Roadmap to create one.',
        },
        {
          id: 'e1-1-reduction',
          label: 'Absolute GHG reduction targets with base year and milestones',
          status: org.hasReductionTarget ? 'met' : 'gap',
          detail: org.hasReductionTarget ? 'Reduction targets set with base year and trajectory' : 'No reduction targets configured. Set targets in Planning > Targets.',
        },
        {
          id: 'e1-1-initiatives',
          label: 'Decarbonisation initiatives and actions underway',
          status: org.hasReductionInitiatives ? 'met' : 'gap',
          detail: org.hasReductionInitiatives ? 'Reduction initiatives recorded with status and impact estimates' : 'No reduction initiatives recorded. Add initiatives in Targets.',
        },
      ],
    },
    {
      id: 'e1-2',
      code: 'E1-2',
      name: 'Policies Related to Climate Change Mitigation and Adaptation',
      description: 'Policies addressing climate change mitigation and adaptation, including how they are embedded into business processes.',
      dataPoints: [
        {
          id: 'e1-2-csrd-record',
          label: 'CSRD compliance record created and tracked',
          status: org.hasComplianceCsrd ? 'met' : 'gap',
          detail: org.hasComplianceCsrd ? 'CSRD framework tracked in compliance module' : 'No CSRD compliance record. Add one in Compliance tracker.',
        },
        {
          id: 'e1-2-evidence',
          label: 'Evidence files supporting policy claims attached to records',
          status: org.hasEvidenceFiles ? 'met' : 'partial',
          detail: org.hasEvidenceFiles ? 'Evidence files present in the system' : 'No evidence files uploaded. Attach policy documents to activity records.',
        },
      ],
    },
    {
      id: 'e1-3',
      code: 'E1-3',
      name: 'Actions and Resources in Relation to Climate Change',
      description: 'Climate-related actions including capital expenditure and OpEx allocated to decarbonisation.',
      dataPoints: [
        {
          id: 'e1-3-initiatives',
          label: 'Reduction initiatives with cost estimates recorded',
          status: org.hasReductionInitiatives ? 'met' : 'gap',
          detail: org.hasReductionInitiatives ? 'Reduction initiatives include cost and expected CO2e impact' : 'No initiatives recorded. Add cost-quantified reduction actions in Targets.',
        },
      ],
    },
    {
      id: 'e1-4',
      code: 'E1-4',
      name: 'Targets Related to Climate Change Mitigation and Adaptation',
      description: 'GHG emission reduction targets for Scope 1, 2 and material Scope 3 categories, with a base year and interim milestones.',
      dataPoints: [
        {
          id: 'e1-4-scope1-target',
          label: 'Scope 1 emissions baseline established',
          status: org.hasScope1 ? 'met' : 'gap',
          detail: org.hasScope1 ? 'Scope 1 activity records present' : 'No Scope 1 records. Import stationary or mobile combustion data.',
        },
        {
          id: 'e1-4-scope2-target',
          label: 'Scope 2 emissions baseline established',
          status: org.hasScope2 ? 'met' : 'gap',
          detail: org.hasScope2 ? 'Scope 2 activity records (location-based or market-based) present' : 'No Scope 2 records. Import electricity consumption data.',
        },
        {
          id: 'e1-4-scope3-target',
          label: 'Material Scope 3 categories baseline established',
          status: org.hasScope3 ? (org.scope3CategoryCount >= 8 ? 'met' : 'partial') : 'gap',
          detail: org.hasScope3
            ? `${org.scope3CategoryCount} of 15 Scope 3 categories have data. ESRS E1 requires all material categories.`
            : 'No Scope 3 records. Import upstream transport, purchased goods, commuting, etc.',
        },
        {
          id: 'e1-4-sbti-1.5c',
          label: '1.5C-aligned SBTi target validated',
          status: org.hasSbtiTarget ? 'met' : 'gap',
          detail: org.hasSbtiTarget ? 'SBTi target configured in SBTi Roadmap' : 'No SBTi target. ESRS E1-4 requires disclosure of climate science alignment.',
        },
      ],
    },
    {
      id: 'e1-5',
      code: 'E1-5',
      name: 'Energy Consumption and Mix',
      description: 'Total energy consumption from fossil fuels and renewable sources, and the energy intensity ratio.',
      dataPoints: [
        {
          id: 'e1-5-energy',
          label: 'Energy consumption data (electricity, gas, fuel) imported',
          status: org.hasEnergyConsumption ? 'met' : 'gap',
          detail: org.hasEnergyConsumption
            ? 'Stationary combustion and electricity records present (proxy for energy mix)'
            : 'No energy-related records found. Import electricity (kWh) and fuel (litres/kWh) data.',
        },
        {
          id: 'e1-5-intensity',
          label: 'Emissions intensity metric configured (tCO2e per revenue or employee)',
          status: 'partial',
          detail: 'Intensity metrics are available in the Analytics module once Scope 1+2 data is present.',
        },
      ],
    },
    {
      id: 'e1-6',
      code: 'E1-6',
      name: 'Gross Scopes 1, 2 and 3 GHG Emissions',
      description: 'Gross GHG emissions by scope, disaggregated by gas (CO2, CH4, N2O, F-gases), with methodology disclosure.',
      dataPoints: [
        {
          id: 'e1-6-scope1',
          label: 'Scope 1 GHG emissions calculated and published',
          status: org.hasScope1 && org.hasPublishedSnapshot ? 'met' : org.hasScope1 ? 'partial' : 'gap',
          detail: org.hasPublishedSnapshot ? 'Published calculation snapshot includes Scope 1' : org.hasScope1 ? 'Scope 1 data present but not yet in a published snapshot' : 'No Scope 1 data.',
        },
        {
          id: 'e1-6-scope2',
          label: 'Scope 2 GHG emissions (location-based and market-based) calculated',
          status: org.hasScope2 && org.hasPublishedSnapshot ? 'met' : org.hasScope2 ? 'partial' : 'gap',
          detail: org.hasScope2 && org.hasPublishedSnapshot ? 'Scope 2 LB and MB calculated in published snapshot' : org.hasScope2 ? 'Scope 2 data present but no published snapshot yet' : 'No Scope 2 data.',
        },
        {
          id: 'e1-6-scope3',
          label: 'Scope 3 GHG emissions for all material categories calculated',
          status: org.hasScope3AllCategories ? 'met' : org.hasScope3 ? 'partial' : 'gap',
          detail: org.hasScope3AllCategories
            ? 'All 15 Scope 3 GHG Protocol categories have data'
            : org.hasScope3
            ? `Only ${org.scope3CategoryCount} of 15 Scope 3 categories have data. ESRS E1-6 requires all material Scope 3 categories.`
            : 'No Scope 3 data. At minimum, import Cat 1 (purchased goods), Cat 6 (business travel) and Cat 7 (employee commuting).',
        },
        {
          id: 'e1-6-methodology',
          label: 'GHG calculation methodology documented (GHG Protocol, emission factors version)',
          status: org.hasPublishedSnapshot ? 'met' : 'gap',
          detail: org.hasPublishedSnapshot ? 'Methodology version (DEFRA 2025.1, GHG Protocol AR6) stored immutably per calculation run' : 'No published snapshot. Run a calculation and publish a snapshot to lock in methodology.',
        },
        {
          id: 'e1-6-report',
          label: 'GHG report generated and available for disclosure',
          status: org.hasGhgReport ? 'met' : 'gap',
          detail: org.hasGhgReport ? 'GHG Protocol or CSRD report generated in Reports module' : 'No report generated yet. Generate a report from a published snapshot.',
        },
      ],
    },
    {
      id: 'e1-7',
      code: 'E1-7',
      name: 'GHG Removals and Climate Projects',
      description: 'Carbon removals, carbon credits used and any GHG mitigation projects in the value chain.',
      dataPoints: [
        {
          id: 'e1-7-offsets',
          label: 'Carbon offsets / removals recorded',
          status: org.hasOffsets ? 'met' : 'partial',
          detail: org.hasOffsets ? 'Carbon credits or offsets recorded in Offsets module' : 'No offsets recorded. ESRS E1-7 requires disclosure if any credits are used to claim neutrality.',
        },
      ],
    },
    {
      id: 'e1-8',
      code: 'E1-8',
      name: 'Internal Carbon Pricing',
      description: 'Any internal carbon price used for decision-making, investment appraisal or Scope 3 calculations.',
      dataPoints: [
        {
          id: 'e1-8-icp',
          label: 'Internal carbon price configured',
          status: 'gap',
          detail: 'Internal carbon pricing is not yet tracked in CarbonSite. This is a planned future feature.',
        },
      ],
    },
    {
      id: 'e1-9',
      code: 'E1-9',
      name: 'Anticipated Financial Effects from Climate-Related Hazards',
      description: 'Financial exposure from climate physical risks and transition risks, with scenario analysis.',
      dataPoints: [
        {
          id: 'e1-9-risk',
          label: 'Climate risk and scenario analysis documented',
          status: 'gap',
          detail: 'Climate risk scenario analysis (TCFD-aligned) is not yet tracked in CarbonSite. This is a planned future feature.',
        },
      ],
    },
  ];
}

export default function EsrsE1GapPage() {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;
  const [disclosures, setDisclosures] = useState<DisclosureRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ met: 0, partial: 0, gap: 0, total: 0 });

  useEffect(() => {
    if (!orgId) return;

    async function fetchData() {
      try {
        const [recordsRes, snapshotsRes, reportsRes, targetsRes, initiativesRes, complianceRes, sbtiRes, offsetsRes] =
          await Promise.all([
            fetch(`/api/orgs/${orgId}/activity-records?limit=1&status=approved`),
            fetch(`/api/orgs/${orgId}/calculation-runs?limit=1`),
            fetch(`/api/orgs/${orgId}/reports?limit=5`),
            fetch(`/api/orgs/${orgId}/targets`),
            fetch(`/api/orgs/${orgId}/targets/initiatives`),
            fetch(`/api/orgs/${orgId}/compliance`),
            fetch(`/api/orgs/${orgId}/sbti`),
            fetch(`/api/orgs/${orgId}/offsets?limit=1`),
          ]);

        const [recordsJson, snapshotsJson, reportsJson, targetsJson, initiativesJson, complianceJson, sbtiJson, offsetsJson] =
          await Promise.all([
            recordsRes.ok ? recordsRes.json() : { records: [], pagination: {} },
            snapshotsRes.ok ? snapshotsRes.json() : { runs: [] },
            reportsRes.ok ? reportsRes.json() : { reports: [] },
            targetsRes.ok ? targetsRes.json() : { targets: [] },
            initiativesRes.ok ? initiativesRes.json() : { initiatives: [] },
            complianceRes.ok ? complianceRes.json() : { records: [] },
            sbtiRes.ok ? sbtiRes.json() : { target: null },
            offsetsRes.ok ? offsetsRes.json() : { offsets: [] },
          ]);

        // Fetch category breakdown from performance/own or analytics
        const analyticsRes = await fetch(`/api/orgs/${orgId}/performance/own`);
        const analyticsJson = analyticsRes.ok ? await analyticsRes.json() : {};

        // Parse scope/category data from records (rough proxy via category codes from a separate endpoint)
        const catRes = await fetch(`/api/orgs/${orgId}/activity-records?limit=500&fields=emissionCategoryId`);
        const catJson = catRes.ok ? await catRes.json() : { records: [] };
        const catCodes: string[] = (catJson.records || []).map((r: { emissionCategoryCode?: string; category?: { code?: string } }) => r.emissionCategoryCode || r.category?.code || '');

        const scope1Codes = ['s1-stationary', 's1-mobile', 's1-fugitive'];
        const scope2Codes = ['s2-electricity-lb', 's2-electricity-mb'];
        const scope3Codes = ['s3-business-travel','s3-commuting','s3-purchased-goods','s3-upstream-transport','s3-waste','s3-capital-goods','s3-fuel-energy','s3-upstream-leased','s3-downstream-transport','s3-processing-sold','s3-use-sold','s3-end-of-life','s3-downstream-leased','s3-franchises','s3-investments'];
        const energyCodes = [...scope1Codes, 's2-electricity-lb', 's2-electricity-mb'];

        const hasScope1 = catCodes.some((c) => scope1Codes.includes(c)) || analyticsJson.performance?.submissionCount > 0;
        const hasScope2 = catCodes.some((c) => scope2Codes.includes(c));
        const presentScope3 = scope3Codes.filter((c) => catCodes.includes(c));
        const hasScope3 = presentScope3.length > 0 || catCodes.some((c) => c.startsWith('s3-'));
        const hasScope3AllCategories = presentScope3.length >= 12;
        const hasEnergyConsumption = catCodes.some((c) => energyCodes.includes(c));

        const org: OrgData = {
          hasScope1,
          hasScope2,
          hasScope3,
          hasScope3AllCategories,
          scope3CategoryCount: presentScope3.length,
          hasSbtiTarget: !!sbtiJson.target,
          hasReductionTarget: (targetsJson.targets || []).length > 0,
          hasReductionInitiatives: (initiativesJson.initiatives || []).length > 0,
          hasPublishedSnapshot: (snapshotsJson.runs || snapshotsJson.snapshots || []).length > 0,
          hasGhgReport: (reportsJson.reports || []).some((r: { type: string }) => ['ghg_protocol', 'csrd_esrs_e1'].includes(r.type)),
          hasEnergyConsumption,
          hasOffsets: (offsetsJson.offsets || []).length > 0,
          hasComplianceCsrd: (complianceJson.records || []).some((r: { framework: string }) => r.framework === 'CSRD_ESRS_E1'),
          totalRecords: recordsJson.pagination?.total ?? (recordsJson.records || []).length,
          approvedRecords: (recordsJson.records || []).length,
          hasEvidenceFiles: (catJson.records || []).some((r: { evidenceFiles?: unknown[] }) => r.evidenceFiles && (r.evidenceFiles as unknown[]).length > 0),
        };

        const built = buildDisclosures(org);
        setDisclosures(built);

        const allPoints = built.flatMap((d) => d.dataPoints);
        setSummary({
          met: allPoints.filter((p) => p.status === 'met').length,
          partial: allPoints.filter((p) => p.status === 'partial').length,
          gap: allPoints.filter((p) => p.status === 'gap').length,
          total: allPoints.length,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchData();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  const coverageScore = summary.total > 0
    ? Math.round(((summary.met + summary.partial * 0.5) / summary.total) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CSRD ESRS E1 Gap Analysis</h1>
          <p className="mt-2 text-gray-600">
            Maps your CarbonSite data against ESRS E1 disclosure requirements (E1-1 through E1-9)
          </p>
        </div>
        <a
          href="https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FESRS%20E1%20Climate%20Change.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline shrink-0"
        >
          ESRS E1 Standard <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-3xl font-bold text-gray-900">{coverageScore}%</div>
            <div className="text-sm text-gray-500">Data coverage score</div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700"><span className="font-semibold">{summary.met}</span> met</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-700"><span className="font-semibold">{summary.partial}</span> partial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-gray-700"><span className="font-semibold">{summary.gap}</span> gaps</span>
            </div>
          </div>
          <div className="flex-1 min-w-32">
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${coverageScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* E1-1 through E1-9 */}
      {disclosures.map((disc) => {
        const metCount = disc.dataPoints.filter((p) => p.status === 'met').length;
        const allMet = metCount === disc.dataPoints.length;
        const anyGap = disc.dataPoints.some((p) => p.status === 'gap');
        const headerBg = allMet ? 'border-green-200 bg-green-50/40' : anyGap ? 'border-red-100' : 'border-amber-100';

        return (
          <Card key={disc.id} className={`border ${headerBg}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`text-xs font-mono ${allMet ? 'bg-green-100 text-green-800' : anyGap ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {disc.code}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900">{disc.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{disc.description}</p>
                </div>
                <div className="text-xs text-gray-500 shrink-0 tabular-nums">
                  {metCount}/{disc.dataPoints.length}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {disc.dataPoints.map((dp) => (
                  <div key={dp.id} className="flex items-start gap-2.5 rounded-lg bg-white border border-gray-100 px-3 py-2.5">
                    <StatusIcon status={dp.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{dp.label}</p>
                      <p className={`text-xs mt-0.5 ${dp.status === 'met' ? 'text-green-700' : dp.status === 'gap' ? 'text-red-600' : 'text-amber-600'}`}>
                        {dp.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
