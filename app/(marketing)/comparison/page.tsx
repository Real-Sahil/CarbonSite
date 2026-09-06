'use client';

import { useState, useMemo } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

type Feature = {
  id: string;
  name: string;
  category: 'Field Capture' | 'Calculation' | 'Reporting' | 'Integration';
  metricora: boolean | 'partial';
  gaia: boolean | 'partial';
  persefoni: boolean | 'partial';
  watershed: boolean | 'partial';
  emitwise: boolean | 'partial';
  differentiator?: boolean;
};

const FEATURES: Feature[] = [
  // Field Capture
  { id: 'ocr', name: 'Mobile data capture', category: 'Field Capture', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
  { id: 'offline', name: 'Offline sync capability', category: 'Field Capture', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
  { id: 'mobile-app', name: 'Mobile field app', category: 'Field Capture', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
  { id: 'photo-upload', name: 'Photo/document upload', category: 'Field Capture', metricora: true, gaia: true, persefoni: true, watershed: true, emitwise: true },
  { id: 'gps-tagging', name: 'GPS auto-tagging', category: 'Field Capture', metricora: true, gaia: false, persefoni: 'partial', watershed: false, emitwise: false },

  // Calculation
  { id: 'audit-trail', name: 'Append-only audit trail', category: 'Calculation', metricora: true, gaia: 'partial', persefoni: true, watershed: 'partial', emitwise: 'partial', differentiator: true },
  { id: 'hash-chain', name: 'Immutable audit trail', category: 'Calculation', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
  { id: 'scope3-estimation', name: 'Scope 3 smart estimation', category: 'Calculation', metricora: true, gaia: false, persefoni: true, watershed: true, emitwise: 'partial' },
  { id: 'invoice-sync', name: 'Invoice sync (Xero/SAP/QB)', category: 'Calculation', metricora: true, gaia: false, persefoni: 'partial', watershed: 'partial', emitwise: false },
  { id: 'anomaly-detection', name: 'Anomaly detection', category: 'Calculation', metricora: true, gaia: false, persefoni: 'partial', watershed: false, emitwise: false },
  { id: 'custom-factors', name: 'Custom emission factors', category: 'Calculation', metricora: true, gaia: true, persefoni: true, watershed: true, emitwise: true },

  // Reporting
  { id: 'real-time-dashboard', name: 'Real-time dashboard updates', category: 'Reporting', metricora: true, gaia: 'partial', persefoni: true, watershed: true, emitwise: 'partial' },
  { id: 'data-lineage', name: 'Data lineage visualization', category: 'Reporting', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
  { id: 'compliance-export', name: 'Compliance evidence export', category: 'Reporting', metricora: true, gaia: false, persefoni: 'partial', watershed: 'partial', emitwise: false },
  { id: 'multi-framework', name: 'Multi-framework (CSRD/SBTi)', category: 'Reporting', metricora: true, gaia: 'partial', persefoni: true, watershed: true, emitwise: 'partial' },
  { id: 'pdf-csv-export', name: 'PDF/CSV report export', category: 'Reporting', metricora: true, gaia: true, persefoni: true, watershed: true, emitwise: true },

  // Integration
  { id: 'api-versioning', name: 'API versioning', category: 'Integration', metricora: true, gaia: false, persefoni: true, watershed: true, emitwise: 'partial' },
  { id: 'sso-saml', name: 'SSO/SAML (Okta/Azure)', category: 'Integration', metricora: true, gaia: 'partial', persefoni: true, watershed: true, emitwise: false },
  { id: 'webhooks', name: 'Webhooks & event streams', category: 'Integration', metricora: true, gaia: false, persefoni: true, watershed: true, emitwise: false },
  { id: 'open-source', name: 'Open-source code', category: 'Integration', metricora: true, gaia: false, persefoni: false, watershed: false, emitwise: false, differentiator: true },
];

const COMPETITORS = ['metricora', 'gaia', 'persefoni', 'watershed', 'emitwise'] as const;
const COMPETITOR_DISPLAY = {
  metricora: { name: 'MetricOra', color: 'bg-blue-50 dark:bg-blue-950', accent: 'text-blue-700' },
  gaia: { name: 'Gaia', color: 'bg-gray-50 dark:bg-gray-900', accent: 'text-gray-700' },
  persefoni: { name: 'Persefoni', color: 'bg-gray-50 dark:bg-gray-900', accent: 'text-gray-700' },
  watershed: { name: 'Watershed', color: 'bg-gray-50 dark:bg-gray-900', accent: 'text-gray-700' },
  emitwise: { name: 'Emitwise', color: 'bg-gray-50 dark:bg-gray-900', accent: 'text-gray-700' },
};

const PRICING = {
  metricora: { tier: 'Freemium', price: '$0–Custom' },
  gaia: { tier: 'Enterprise', price: '$100+/mo' },
  persefoni: { tier: 'Enterprise', price: 'Custom' },
  watershed: { tier: 'Premium', price: '$500+/mo' },
  emitwise: { tier: 'Mid-market', price: '€50+/mo' },
};

const CATEGORIES = ['Field Capture', 'Calculation', 'Reporting', 'Integration'] as const;

export default function ComparisonPage() {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES));

  const filteredFeatures = useMemo(() => {
    return FEATURES.filter(f => selectedCategories.has(f.category));
  }, [selectedCategories]);

  const toggleCategory = (category: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  const renderFeatureCell = (value: boolean | 'partial') => {
    if (value === true) {
      return <Check className="w-5 h-5 text-green-600" strokeWidth={3} />;
    }
    if (value === 'partial') {
      return <AlertCircle className="w-5 h-5 text-yellow-600" strokeWidth={3} />;
    }
    return <X className="w-5 h-5 text-gray-300" strokeWidth={3} />;
  };

  const differentiatorCount = FEATURES.filter(f => f.differentiator && selectedCategories.has(f.category)).length;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-12 md:py-16">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            MetricOra vs. Competitors
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            See how MetricOra stacks up. We focus on field-first architecture, transparency, and Scope 3 automation—advantages that matter for enterprises and mid-market companies managing emissions at scale.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Filter by category:</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategories.has(cat)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {differentiatorCount > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
              Showing {differentiatorCount} MetricOra-exclusive features in selected categories
            </p>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-4 px-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-950 w-48">
                  Feature
                </th>
                {COMPETITORS.map(comp => (
                  <th key={comp} className="text-center py-4 px-4">
                    <div className={`py-3 rounded-lg ${COMPETITOR_DISPLAY[comp].color}`}>
                      <p className="font-bold text-slate-900 dark:text-white">{COMPETITOR_DISPLAY[comp].name}</p>
                      {comp === 'metricora' && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">LEADER</p>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              {/* Pricing Row */}
              <tr className="border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <td className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-slate-50 dark:bg-slate-900">
                  Pricing & Tier
                </td>
                {COMPETITORS.map(comp => (
                  <td key={comp} className="text-center py-3 px-4 text-sm">
                    <p className="font-bold text-slate-900 dark:text-white">{PRICING[comp].price}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{PRICING[comp].tier}</p>
                  </td>
                ))}
              </tr>
            </thead>

            {/* Feature Rows */}
            <tbody>
              {filteredFeatures.map((feature, idx) => (
                <tr
                  key={feature.id}
                  className={`border-b border-slate-200 dark:border-slate-800 transition-colors ${
                    feature.differentiator
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : idx % 2 === 0
                        ? 'bg-white dark:bg-slate-950'
                        : 'bg-slate-50 dark:bg-slate-900'
                  }`}
                >
                  <td className="text-left py-4 px-4 font-medium text-slate-900 dark:text-white sticky left-0 z-10 w-48 bg-inherit">
                    <div className="flex items-start gap-2">
                      {feature.differentiator && (
                        <span className="inline-block bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap mt-0.5">
                          Exclusive
                        </span>
                      )}
                      <span>{feature.name}</span>
                    </div>
                  </td>
                  {COMPETITORS.map(comp => (
                    <td key={`${feature.id}-${comp}`} className="text-center py-4 px-4">
                      <div className="flex justify-center">
                        {renderFeatureCell((feature[comp as keyof Feature] as boolean | 'partial') || false)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Legend:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" strokeWidth={3} />
              <span className="text-sm text-slate-600 dark:text-slate-400">Full support</span>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" strokeWidth={3} />
              <span className="text-sm text-slate-600 dark:text-slate-400">Partial / limited support</span>
            </div>
            <div className="flex items-center gap-3">
              <X className="w-5 h-5 text-gray-300" strokeWidth={3} />
              <span className="text-sm text-slate-600 dark:text-slate-400">Not available</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 px-4 py-12 md:py-16 mt-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to choose the right platform?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            MetricOra brings field-first architecture, transparent methodology, and automated Scope 3 collection. See it in action.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/pricing"
              className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              View Pricing
            </a>
            <a
              href="/demo"
              className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Comparison FAQ</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Why does MetricOra have on-device OCR when others don&apos;t?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Field workers often operate in areas with poor connectivity. Our Flutter app uses Google ML Kit for on-device OCR—zero API calls, zero latency, 100% privacy. Data syncs when they reconnect, offline-first.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              What&apos;s the difference between append-only audit trail and a normal database log?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Normal database logs can be tampered with if someone gains admin access. Our audit trail is immutable: each entry references the previous entry&apos;s SHA-256 hash. If anyone alters a past entry, the hash chain breaks. Auditors can detect tampering instantly.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              How does MetricOra&apos;s Scope 3 estimation work compared to competitors?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Competitors use historical industry averages (generic). MetricOra trains ML models on YOUR historical data—learns your facility&apos;s patterns, then estimates missing values. More accurate than one-size-fits-all factors, and it improves as you submit more data.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Why is open-source important for carbon accounting?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Auditors and regulators need to verify calculation logic. Closed-box tools hide formulas. MetricOra&apos;s code is public on GitHub. Auditors inspect it, fork it, verify it. That transparency builds enterprise trust.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Which platform should we choose based on this comparison?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Choose based on your workflow. Field-heavy operations (contractors, waste management, logistics) benefit most from MetricOra&apos;s mobile OCR and offline support. Enterprise audit-critical orgs (publicly traded, regulated) value our hash-chain immutability and compliance exports. Supplier-heavy companies (apparel, food, manufacturing) need our supplier portal and automated Scope 3 collection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
