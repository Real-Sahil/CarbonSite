'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';

interface Competitor {
  name: string;
  logo?: string;
  website?: string;
}

interface Feature {
  category: string;
  name: string;
  description?: string;
  carbonSite: boolean | string;
  competitors: {
    [key: string]: boolean | string;
  };
}

const competitors: Competitor[] = [
  { name: 'CarbonSite', website: 'carbonsite.app' },
  { name: 'Persefoni', website: 'persefoni.com' },
  { name: 'Watershed', website: 'watershed.com' },
  { name: 'Normative', website: 'normative.io' },
];

const features: Feature[] = [
  {
    category: 'Data Capture',
    name: 'Field Worker Mobile App + OCR',
    description: 'On-device photo extraction of emissions from waste tickets, delivery notes, receipts',
    carbonSite: true,
    competitors: {
      Persefoni: false,
      Watershed: false,
      Normative: false,
    },
  },
  {
    category: 'Data Capture',
    name: 'Supplier Portal',
    description: 'Self-service data entry for suppliers and contractors',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Data Capture',
    name: 'API Integrations',
    description: 'Connect to ERPs, billing systems, spend data sources',
    carbonSite: 'Limited',
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: 'Limited',
    },
  },
  {
    category: 'Data Capture',
    name: 'Spend Data Automation',
    description: 'Auto-extract emissions from credit cards, invoices, accounting systems',
    carbonSite: false,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Calculation',
    name: 'Scope 1 & 2 Engine',
    description: 'Calculate emissions from energy, fuel, waste data',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Calculation',
    name: 'Scope 3 ML Estimation',
    description: 'Predict supplier emissions from spend + peer data',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Calculation',
    name: 'Anomaly Detection',
    description: 'Automatically flag outliers and suspicious records (Z-score, domain rules)',
    carbonSite: true,
    competitors: {
      Persefoni: 'Basic',
      Watershed: 'Basic',
      Normative: false,
    },
  },
  {
    category: 'Calculation',
    name: 'GHG Protocol v2 Ready',
    description: 'Compliant with latest GHG Protocol Scope 3 standard',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Transparency',
    name: 'Open-Source Code',
    description: 'Public GitHub repo: audit calculation logic directly',
    carbonSite: true,
    competitors: {
      Persefoni: false,
      Watershed: false,
      Normative: false,
    },
  },
  {
    category: 'Transparency',
    name: 'Public Emission Factors',
    description: 'DEFRA, EPA factors published on GitHub with version control',
    carbonSite: true,
    competitors: {
      Persefoni: false,
      Watershed: false,
      Normative: false,
    },
  },
  {
    category: 'Transparency',
    name: 'Visible Calculation Formulas',
    description: 'See the math: CO2e = amount × factor × GWP coefficients',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Transparency',
    name: 'Factor Versioning & Audit Trail',
    description: 'Track which factor versions were used for each calculation',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Reporting',
    name: 'Interactive Dashboard',
    description: 'Real-time or polling-based emissions trends, facility breakdown, scope analysis',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Reporting',
    name: 'Real-Time Updates',
    description: 'Server-sent events or WebSockets for live dashboard refresh',
    carbonSite: 'Roadmap Q2',
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Reporting',
    name: 'PDF Report Generation',
    description: 'Export comprehensive PDF reports with charts, methodology, audit trail',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Reporting',
    name: 'CSRD Report Template',
    description: 'Pre-built template for EU double materiality + ESG disclosure',
    carbonSite: 'Roadmap Q3',
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Reporting',
    name: 'Data Export (CSV, JSON, API)',
    description: 'Download or stream data for external analysis',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Compliance',
    name: 'Immutable Audit Trail',
    description: 'Append-only logs with SHA-256 hash chains, no retroactive edits',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Compliance',
    name: 'SOC 2 Certified',
    description: 'Type II security and compliance certification',
    carbonSite: 'In progress',
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Compliance',
    name: 'GDPR / CCPA Ready',
    description: 'Data privacy controls, DSAR export, erasure workflows',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Enterprise',
    name: 'SSO / SAML',
    description: 'Okta, Azure AD, generic OIDC authentication',
    carbonSite: 'Roadmap Q2',
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Enterprise',
    name: 'Multi-Org Management',
    description: 'Single admin console for multiple organizations / subsidiaries',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Enterprise',
    name: 'Role-Based Access Control (6+ Roles)',
    description: 'Admin, editor, reviewer, viewer, auditor, field_worker roles',
    carbonSite: true,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: true,
    },
  },
  {
    category: 'Enterprise',
    name: 'SLA / Dedicated Support',
    description: 'Enterprise support contracts with uptime guarantees',
    carbonSite: false,
    competitors: {
      Persefoni: true,
      Watershed: true,
      Normative: false,
    },
  },
  {
    category: 'Pricing',
    name: 'Transparent Public Pricing',
    description: 'No "contact sales" required to see cost',
    carbonSite: true,
    competitors: {
      Persefoni: false,
      Watershed: false,
      Normative: true,
    },
  },
  {
    category: 'Pricing',
    name: 'Freemium Tier',
    description: 'Free plan for SMBs and pilots',
    carbonSite: true,
    competitors: {
      Persefoni: false,
      Watershed: false,
      Normative: true,
    },
  },
  {
    category: 'Pricing',
    name: 'Price Range',
    description: 'Starting cost per year',
    carbonSite: '$0 (free) to $6k/year',
    competitors: {
      Persefoni: '$50k–150k/year',
      Watershed: '$20k–80k/year',
      Normative: '$0 (free) to $60k/year',
    },
  },
];

const categories = Array.from(new Set(features.map((f) => f.category)));

function FeatureCell({ value, isHighlight }: { value: boolean | string; isHighlight?: boolean }) {
  if (value === true) {
    return (
      <div className={`flex items-center justify-center ${isHighlight ? 'bg-blue-50' : ''}`}>
        <Check className="w-5 h-5 text-green-600" />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className={`flex items-center justify-center ${isHighlight ? 'bg-blue-50' : ''}`}>
        <X className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center text-sm text-gray-600 ${isHighlight ? 'bg-blue-50' : ''}`}>
      {value}
    </div>
  );
}

export default function ComparisonPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFeatures = selectedCategory
    ? features.filter((f) => f.category === selectedCategory)
    : features;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            How CarbonSite Compares
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            See how CarbonSite stacks up against enterprise platforms. We compete on transparency,
            field capture, and cost-efficiency.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Features
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-4 px-4 font-bold text-gray-900 min-w-64 bg-gray-50">
                  Feature
                </th>
                {competitors.map((comp) => (
                  <th
                    key={comp.name}
                    className={`text-center py-4 px-4 font-bold min-w-32 ${
                      comp.name === 'CarbonSite' ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-bold text-gray-900">{comp.name}</div>
                    {comp.website && (
                      <div className="text-xs text-gray-500 mt-1">{comp.website}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feature, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="py-4 px-4">
                    <div className="font-semibold text-gray-900">{feature.name}</div>
                    {feature.description && (
                      <div className="text-xs text-gray-600 mt-1">{feature.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-2 font-medium uppercase tracking-wide">
                      {feature.category}
                    </div>
                  </td>
                  <td className="text-center py-4 px-4 bg-blue-50">
                    <FeatureCell value={feature.carbonSite} isHighlight={true} />
                  </td>
                  {competitors.slice(1).map((comp) => (
                    <td key={comp.name} className="text-center py-4 px-4">
                      <FeatureCell value={feature.competitors[comp.name]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 rounded-lg mt-8">
        <h3 className="font-bold text-gray-900 mb-4">Legend</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-gray-700">Shipped</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">Not available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs">Roadmap Q2/Q3</span>
            <span className="text-gray-700">Coming soon</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to switch?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            CarbonSite is 10x cheaper than Persefoni, with field capture, open-source transparency,
            and audit-ready controls built in.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/start"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
