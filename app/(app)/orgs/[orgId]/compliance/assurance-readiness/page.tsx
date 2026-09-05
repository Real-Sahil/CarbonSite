'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, MinusCircle } from 'lucide-react';
import type { AssuranceReadinessResponse, AssuranceCheck } from '@/app/api/orgs/[orgId]/compliance/assurance-readiness/route';

function StatusIcon({ status }: { status: AssuranceCheck['status'] }) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
    case 'fail': return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
    case 'partial': return <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />;
    default: return <MinusCircle className="h-5 w-5 text-gray-300 shrink-0" />;
  }
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{score}%</span>
    </div>
  );
}

function AssuranceLevelBadge({ level }: { level: AssuranceReadinessResponse['assuranceLevel'] }) {
  switch (level) {
    case 'reasonable':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-3 py-1">Ready for Reasonable Assurance</Badge>;
    case 'limited':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-sm px-3 py-1">Limited Assurance Ready</Badge>;
    default:
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-sm px-3 py-1">Not Assurance Ready</Badge>;
  }
}

export default function AssuranceReadinessPage() {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;
  const [data, setData] = useState<AssuranceReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/orgs/${orgId}/compliance/assurance-readiness`)
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Failed to load assurance readiness data: {error}</p>
        </div>
      </div>
    );
  }

  const categories = [...new Set(data.checks.map((c) => c.category))];

  const scoreColor = data.overallScore >= 80 ? 'text-green-700' : data.overallScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const ringColor = data.overallScore >= 80 ? '#16a34a' : data.overallScore >= 60 ? '#d97706' : '#dc2626';
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (data.overallScore / 100) * circumference;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assurance Readiness</h1>
        <p className="mt-2 text-gray-600">
          Scores your data quality, audit trail, and methodology against third-party assurance requirements (CSRD, ISAE 3000, AA1000)
        </p>
      </div>

      {/* Overall score */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardContent className="flex items-center justify-center py-8">
            <div className="relative">
              <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={ringColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{data.overallScore}</span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assurance Level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssuranceLevelBadge level={data.assuranceLevel} />
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{data.summary.passed}</div>
                <div className="text-xs text-green-600">Passed</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{data.summary.partial}</div>
                <div className="text-xs text-amber-600">Partial</div>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{data.summary.failed}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {data.assuranceLevel === 'reasonable'
                ? 'Your data meets the bar for reasonable assurance engagement under ISAE 3000 / AA1000AS. Engage an accredited third-party verifier.'
                : data.assuranceLevel === 'limited'
                ? 'Data quality supports limited assurance. Address partial and failed checks to reach reasonable assurance.'
                : 'Significant gaps in data completeness or audit trail. Address all failed checks before engaging a verifier.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Checks by category */}
      {categories.map((category) => {
        const catChecks = data.checks.filter((c) => c.category === category && c.status !== 'na');
        if (catChecks.length === 0) return null;
        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{category}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-50">
              {catChecks.map((check) => (
                <div key={check.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <StatusIcon status={check.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{check.name}</p>
                      <ScoreBar score={check.score} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{check.description}</p>
                    <p className={`text-xs mt-1 font-medium ${
                      check.status === 'pass' ? 'text-green-700' :
                      check.status === 'fail' ? 'text-red-600' : 'text-amber-600'
                    }`}>{check.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
