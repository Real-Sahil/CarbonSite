'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface StatutoryDeadline {
  id: string;
  framework: string;
  description: string;
  dueDate: string; // ISO date string
  reportingYear: number;
  applicability: string;
  authority: string;
  penalty?: string;
  category: 'uk' | 'eu' | 'international';
  complianceFramework: string; // matches ComplianceRecord.framework enum
}

interface ComplianceRecord {
  framework: string;
  reportingYear: number;
  status: string;
}

const STATUTORY_DEADLINES: StatutoryDeadline[] = [
  // UK deadlines
  {
    id: 'secr-2025',
    framework: 'UK SECR',
    description: 'Streamlined Energy & Carbon Reporting — annual directors\' report disclosure',
    dueDate: '2026-06-30',
    reportingYear: 2025,
    applicability: 'Large UK companies (>250 employees or >£36m turnover)',
    authority: 'Companies House / BEIS',
    penalty: 'Criminal sanctions under Companies Act 2006',
    category: 'uk',
    complianceFramework: 'SECR',
  },
  {
    id: 'esos-phase3',
    framework: 'UK ESOS Phase 3',
    description: 'Energy Savings Opportunity Scheme — energy audit submission to Environment Agency',
    dueDate: '2026-12-05',
    reportingYear: 2026,
    applicability: 'Large UK undertakings (>250 employees or >€50m turnover)',
    authority: 'Environment Agency (EA)',
    penalty: 'Up to £90,000 civil penalty per non-compliance period',
    category: 'uk',
    complianceFramework: 'ESOS',
  },
  {
    id: 'uk-ets-2025',
    framework: 'UK ETS Surrender',
    description: 'UK Emissions Trading Scheme — annual allowance surrender deadline',
    dueDate: '2026-04-30',
    reportingYear: 2025,
    applicability: 'UK ETS participants (power, aviation, heavy industry)',
    authority: 'Environment Agency (EA)',
    penalty: '£100 per excess tonne CO2e; public disclosure of non-compliance',
    category: 'uk',
    complianceFramework: 'ETS',
  },
  {
    id: 'cdp-2026',
    framework: 'CDP Disclosure',
    description: 'CDP Climate Change questionnaire response deadline',
    dueDate: '2026-07-22',
    reportingYear: 2025,
    applicability: 'Companies scored by CDP (investor or customer request)',
    authority: 'CDP (formerly Carbon Disclosure Project)',
    category: 'international',
    complianceFramework: 'CDP',
  },
  // EU deadlines
  {
    id: 'csrd-phase1-2025',
    framework: 'CSRD (Phase 1)',
    description: 'Corporate Sustainability Reporting Directive — first ESRS E1 report for large PIEs',
    dueDate: '2025-12-31',
    reportingYear: 2024,
    applicability: 'Large EU public-interest entities with >500 employees (FY2024)',
    authority: 'European Securities and Markets Authority (ESMA)',
    penalty: 'Member-state sanctions; name-and-shame public register',
    category: 'eu',
    complianceFramework: 'CSRD_ESRS_E1',
  },
  {
    id: 'csrd-phase2-2026',
    framework: 'CSRD (Phase 2)',
    description: 'Corporate Sustainability Reporting Directive — large companies not in Phase 1',
    dueDate: '2026-12-31',
    reportingYear: 2025,
    applicability: 'Large EU companies >250 employees or >€40m turnover (FY2025)',
    authority: 'ESMA / National Competent Authorities',
    penalty: 'Member-state sanctions; reputational risk',
    category: 'eu',
    complianceFramework: 'CSRD_ESRS_E1',
  },
  {
    id: 'cbam-2026',
    framework: 'EU CBAM Full',
    description: 'Carbon Border Adjustment Mechanism — first financial liability payment',
    dueDate: '2026-05-31',
    reportingYear: 2025,
    applicability: 'EU importers of cement, steel, aluminium, fertilisers, electricity, hydrogen',
    authority: 'European Commission / National Customs Authorities',
    penalty: 'Fine of €10-50 per tonne of undeclared CO2; potential import suspension',
    category: 'eu',
    complianceFramework: 'CBAM',
  },
  {
    id: 'sbti-validation-2026',
    framework: 'SBTi Validation',
    description: 'Science Based Targets initiative — target validation 24-month window',
    dueDate: '2026-09-30',
    reportingYear: 2026,
    applicability: 'Companies committed to SBTi (committed status >24 months)',
    authority: 'Science Based Targets initiative (SBTi)',
    penalty: 'Removal from SBTi "Committed" list; reputational impact',
    category: 'international',
    complianceFramework: 'SBTI',
  },
];

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number): string {
  if (days < 0) return 'bg-gray-100 text-gray-500 border-gray-200';
  if (days <= 30) return 'bg-red-100 text-red-800 border-red-200';
  if (days <= 90) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function getCategoryBadge(cat: string) {
  switch (cat) {
    case 'uk': return 'bg-blue-100 text-blue-800';
    case 'eu': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export default function RegulatoryCalendarPage() {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/orgs/${orgId}/compliance`)
      .then((r) => r.json())
      .then((json) => setComplianceRecords(json.records || []))
      .catch(() => {});
  }, [orgId]);

  const getOrgStatus = (deadline: StatutoryDeadline) => {
    return complianceRecords.find(
      (r) => r.framework === deadline.complianceFramework && r.reportingYear === deadline.reportingYear
    );
  };

  const now = new Date();
  const upcoming = STATUTORY_DEADLINES.filter((d) => new Date(d.dueDate) >= now).sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  const past = STATUTORY_DEADLINES.filter((d) => new Date(d.dueDate) < now).sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );

  const nextUrgent = upcoming.find((d) => getDaysUntil(d.dueDate) <= 90);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regulatory Calendar</h1>
          <p className="mt-2 text-gray-600">Statutory reporting deadlines for UK, EU and international frameworks</p>
        </div>
        <Link
          href={`/orgs/${orgId}/compliance`}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          Compliance tracker <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {nextUrgent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              {nextUrgent.framework} deadline in {getDaysUntil(nextUrgent.dueDate)} days
            </p>
            <p className="mt-0.5 text-sm text-amber-800">{nextUrgent.description}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
        {upcoming.map((deadline) => {
          const days = getDaysUntil(deadline.dueDate);
          const orgRecord = getOrgStatus(deadline);
          return (
            <Card key={deadline.id} className="border-gray-200">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">{deadline.framework}</span>
                      <Badge className={`text-xs ${getCategoryBadge(deadline.category)}`}>
                        {deadline.category.toUpperCase()}
                      </Badge>
                      {orgRecord && (
                        <Badge className="text-xs bg-green-100 text-green-800 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {orgRecord.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{deadline.description}</p>
                    <p className="text-xs text-gray-500 mb-1"><span className="font-medium">Applies to:</span> {deadline.applicability}</p>
                    <p className="text-xs text-gray-500 mb-1"><span className="font-medium">Authority:</span> {deadline.authority}</p>
                    {deadline.penalty && (
                      <p className="text-xs text-red-600"><span className="font-medium">Penalty:</span> {deadline.penalty}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${getUrgencyColor(days)}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {days} days
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(deadline.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">FY{deadline.reportingYear}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {past.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-500">Past Deadlines</h2>
          {past.map((deadline) => {
            const orgRecord = getOrgStatus(deadline);
            return (
              <Card key={deadline.id} className="border-gray-100 bg-gray-50/50 opacity-70">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-600">{deadline.framework}</span>
                        <Badge className={`text-xs ${getCategoryBadge(deadline.category)}`}>
                          {deadline.category.toUpperCase()}
                        </Badge>
                        {orgRecord ? (
                          <Badge className="text-xs bg-green-100 text-green-800">{orgRecord.status}</Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-500">Not recorded</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{deadline.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-gray-500">
                        {new Date(deadline.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500">FY{deadline.reportingYear}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
