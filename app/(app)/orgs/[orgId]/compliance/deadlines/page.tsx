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
  /** How the date is set, when it is not one fixed date for everyone. */
  dueNote?: string;
  reportingYear: number;
  applicability: string;
  authority: string;
  penalty?: string;
  category: 'uk' | 'eu' | 'international';
  complianceFramework: string; // matches ComplianceRecord.framework
  /** Official page the date and thresholds were checked against. */
  source: string;
}

interface ComplianceRecord {
  framework: string;
  reportingYear: number;
  status: string;
}

/** When the dates, thresholds and sources below were last checked. Recheck each quarter. */
const LAST_CHECKED = '26 September 2026';

const STATUTORY_DEADLINES: StatutoryDeadline[] = [
  // UK
  {
    id: 'secr-2025',
    framework: 'UK SECR',
    description: 'Streamlined Energy and Carbon Reporting in the directors\' report, filed with the annual accounts',
    dueDate: '2026-09-30',
    dueNote: 'Due with the accounts: 9 months after the year end for a private company, 6 months for a public one. Date shown for a 31 December year end.',
    reportingYear: 2025,
    applicability: 'Quoted companies, and unquoted companies and LLPs meeting two of: 250 or more employees, turnover over £36m, balance sheet over £18m. SECR keeps these thresholds after the April 2025 company size changes.',
    authority: 'Companies House (policy: Department for Energy Security and Net Zero)',
    penalty: 'Offences under the Companies Act 2006 for a directors\' report that does not comply',
    category: 'uk',
    complianceFramework: 'SECR',
    source: 'https://www.gov.uk/government/publications/environmental-reporting-guidelines-including-mandatory-greenhouse-gas-emissions-reporting-guidance',
  },
  {
    id: 'secr-2026',
    framework: 'UK SECR',
    description: 'Streamlined Energy and Carbon Reporting in the directors\' report, filed with the annual accounts',
    dueDate: '2027-09-30',
    dueNote: 'Due with the accounts: 9 months after the year end for a private company, 6 months for a public one. Date shown for a 31 December year end.',
    reportingYear: 2026,
    applicability: 'Quoted companies, and unquoted companies and LLPs meeting two of: 250 or more employees, turnover over £36m, balance sheet over £18m.',
    authority: 'Companies House (policy: Department for Energy Security and Net Zero)',
    penalty: 'Offences under the Companies Act 2006 for a directors\' report that does not comply',
    category: 'uk',
    complianceFramework: 'SECR',
    source: 'https://www.gov.uk/government/publications/environmental-reporting-guidelines-including-mandatory-greenhouse-gas-emissions-reporting-guidance',
  },
  {
    id: 'esos-phase4-qualification',
    framework: 'UK ESOS Phase 4',
    description: 'Qualification date: whether the group is in ESOS Phase 4 is decided by its size on this day',
    dueDate: '2026-12-31',
    reportingYear: 2026,
    applicability: 'A UK undertaking with 250 or more employees, or turnover over £44m and balance sheet over £38m; one qualifying company brings in its whole UK group',
    authority: 'Environment Agency (England); SEPA, NRW and DAERA elsewhere',
    category: 'uk',
    complianceFramework: 'ESOS',
    source: 'https://www.gov.uk/government/publications/comply-with-the-energy-savings-opportunity-scheme-esos-phase-4/how-to-comply-with-the-energy-savings-opportunity-scheme-esos-phase-4',
  },
  {
    id: 'esos-phase4-compliance',
    framework: 'UK ESOS Phase 4',
    description: 'Energy audit completed and notification of compliance submitted',
    dueDate: '2027-12-05',
    reportingYear: 2027,
    applicability: 'Groups that qualified on 31 December 2026',
    authority: 'Environment Agency (England); SEPA, NRW and DAERA elsewhere',
    penalty: 'Civil penalties set by the regulator for failing to notify or audit',
    category: 'uk',
    complianceFramework: 'ESOS',
    source: 'https://www.gov.uk/government/publications/comply-with-the-energy-savings-opportunity-scheme-esos-phase-4/how-to-comply-with-the-energy-savings-opportunity-scheme-esos-phase-4',
  },
  {
    id: 'uk-srs-2027',
    framework: 'UK SRS (listed companies)',
    description: 'Climate disclosures under UK SRS S2 for accounting periods beginning on or after 1 January 2027 (proposed by the FCA in CP26/5; final rules expected autumn 2026)',
    dueDate: '2027-01-01',
    dueNote: 'Start of the first reporting period, not a filing date. Scope 3 is comply or explain in the first year.',
    reportingYear: 2027,
    applicability: 'UK listed companies in the FCA\'s scope; a supplier to one may be asked for its data',
    authority: 'Financial Conduct Authority',
    category: 'uk',
    complianceFramework: 'UK_SRS',
    source: 'https://www.fca.org.uk/publications/consultation-papers/cp26-5-sustainability-disclosures',
  },
  {
    id: 'uk-cbam-start',
    framework: 'UK CBAM',
    description: 'UK Carbon Border Adjustment Mechanism starts: register with HMRC once CBAM goods imports reach £50,000 in 12 months (or are expected to in the next 30 days)',
    dueDate: '2027-01-01',
    reportingYear: 2027,
    applicability: 'UK importers of aluminium, cement, fertiliser, hydrogen, and iron and steel goods',
    authority: 'HM Revenue & Customs',
    category: 'uk',
    complianceFramework: 'CBAM',
    source: 'https://www.gov.uk/government/collections/check-if-youll-need-to-register-for-carbon-border-adjustment-mechanism-cbam',
  },
  {
    id: 'uk-ets-2026',
    framework: 'UK ETS surrender',
    description: 'Surrender allowances for 2026 emissions (the verified emissions report is due 31 March)',
    dueDate: '2027-04-30',
    reportingYear: 2026,
    applicability: 'UK ETS installations, aircraft operators and, from 2026, domestic maritime',
    authority: 'Environment Agency and the UK ETS Authority',
    penalty: 'Excess emissions penalty of £100 per tonne not covered (index-linked), and the allowances are still owed',
    category: 'uk',
    complianceFramework: 'ETS',
    source: 'https://www.gov.uk/government/publications/participating-in-the-uk-ets/participating-in-the-uk-ets',
  },
  {
    id: 'uk-cbam-2027-return',
    framework: 'UK CBAM',
    description: 'First UK CBAM return and payment, for imports in 2027',
    dueDate: '2028-05-31',
    reportingYear: 2027,
    applicability: 'Importers registered for UK CBAM',
    authority: 'HM Revenue & Customs',
    category: 'uk',
    complianceFramework: 'CBAM',
    source: 'https://www.gov.uk/government/collections/check-if-youll-need-to-register-for-carbon-border-adjustment-mechanism-cbam',
  },
  // EU
  {
    id: 'eu-cbam-certificates',
    framework: 'EU CBAM',
    description: 'CBAM certificates go on sale for goods imported into the EU during 2026',
    dueDate: '2027-02-01',
    reportingYear: 2026,
    applicability: 'Authorised CBAM declarants importing over 50 tonnes a year of cement, iron and steel, aluminium, fertilisers, hydrogen or electricity',
    authority: 'European Commission and national competent authorities',
    category: 'eu',
    complianceFramework: 'CBAM',
    source: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en',
  },
  {
    id: 'eu-cbam-2026-declaration',
    framework: 'EU CBAM',
    description: 'First annual CBAM declaration and certificate surrender, for 2026 imports',
    dueDate: '2027-09-30',
    reportingYear: 2026,
    applicability: 'Authorised CBAM declarants (over 50 tonnes a year of CBAM goods)',
    authority: 'European Commission and national competent authorities',
    penalty: 'Penalty equal to the EU ETS excess emissions penalty for each certificate not surrendered',
    category: 'eu',
    complianceFramework: 'CBAM',
    source: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en',
  },
  {
    id: 'csrd-2027',
    framework: 'CSRD',
    description: 'Sustainability statement under ESRS for financial year 2027, the first year under the thresholds set by Directive (EU) 2026/470',
    dueDate: '2028-12-31',
    dueNote: 'Published with the 2027 management report during 2028; the date shown is the latest it can fall.',
    reportingYear: 2027,
    applicability: 'EU companies with over 1,000 employees and over €450m net turnover; non-EU groups with over €450m EU turnover and an EU subsidiary or branch over €200m',
    authority: 'National competent authorities (transposition due by March 2027)',
    penalty: 'Set by each member state',
    category: 'eu',
    complianceFramework: 'CSRD_ESRS_E1',
    source: 'https://www.consilium.europa.eu/en/press/press-releases/2026/02/24/council-signs-off-simplification-of-sustainability-reporting-and-due-diligence-requirements-to-boost-eu-competitiveness/',
  },
  // International
  {
    id: 'cdp-2026',
    framework: 'CDP',
    description: 'Final 2026 CDP response deadline (responses for scoring were due 16 September 2026)',
    dueDate: '2026-10-28',
    reportingYear: 2025,
    applicability: 'Companies asked to disclose by investors or customers',
    authority: 'CDP',
    category: 'international',
    complianceFramework: 'CDP',
    source: 'https://www.cdp.net/en/disclosure-2026',
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
          <p className="mt-1 text-xs text-gray-500">Dates and thresholds checked against the official sources on {LAST_CHECKED}. Confirm your own dates with your adviser.</p>
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
                    {deadline.dueNote && (
                      <p className="text-xs text-gray-500 mb-1"><span className="font-medium">Date:</span> {deadline.dueNote}</p>
                    )}
                    {deadline.penalty && (
                      <p className="text-xs text-red-600"><span className="font-medium">Penalty:</span> {deadline.penalty}</p>
                    )}
                    <a href={deadline.source} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Official source</a>
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
