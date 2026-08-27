import Link from "next/link";
import { Metadata } from "next";
import { Check, X } from "lucide-react";

export const metadata: Metadata = {
  title: "Comparison | CarbonSite vs. Competitors",
  description: "How CarbonSite compares to other carbon accounting platforms. Transparency, field capture, audit readiness.",
  openGraph: {
    title: "Comparison | CarbonSite vs. Competitors",
    description: "Feature-by-feature comparison of carbon accounting platforms.",
    type: "website",
  },
};

export default function ComparisonPage() {
  const features = [
    {
      category: "Data Ingestion",
      items: [
        { name: "CSV/Excel Import", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: true },
        { name: "API Integrations", carbonsite: true, normative: true, watershed: true, gaia: false, emitwise: false },
        { name: "Mobile Field Capture", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "OCR for Documents", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Offline-First Sync", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
      ],
    },
    {
      category: "Calculation Engine",
      items: [
        { name: "Scope 1/2 Calculation", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: true },
        { name: "Scope 3 Estimation", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: false },
        { name: "Custom Emission Factors", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: false },
        { name: "Methodology Versioning", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Formula Transparency", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
      ],
    },
    {
      category: "Reporting & Audit",
      items: [
        { name: "Custom Report Builder", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: true },
        { name: "Audit Trail", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Data Lineage Visualization", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Immutable Snapshots", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Version Control for Reports", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
      ],
    },
    {
      category: "Compliance",
      items: [
        { name: "CSRD Ready", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: false },
        { name: "SBTi Integration", carbonsite: true, normative: true, watershed: true, gaia: false, emitwise: false },
        { name: "CDP Export Template", carbonsite: true, normative: true, watershed: true, gaia: false, emitwise: false },
        { name: "Open Methodology", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
      ],
    },
    {
      category: "Enterprise",
      items: [
        { name: "SSO/SAML", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: false },
        { name: "Role-Based Access Control", carbonsite: true, normative: true, watershed: true, gaia: true, emitwise: false },
        { name: "Audit-Grade Security Logs", carbonsite: true, normative: false, watershed: false, gaia: false, emitwise: false },
        { name: "Transparent Pricing", carbonsite: true, normative: false, watershed: false, gaia: true, emitwise: true },
      ],
    },
  ];

  const competitors = [
    { name: "CarbonSite", slug: "carbonsite", bg: "bg-blue-50" },
    { name: "Normative", slug: "normative", bg: "bg-gray-50" },
    { name: "Watershed", slug: "watershed", bg: "bg-gray-50" },
    { name: "Gaia", slug: "gaia", bg: "bg-gray-50" },
    { name: "Emitwise", slug: "emitwise", bg: "bg-gray-50" },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#FAFBF8] text-[#111827] py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            How CarbonSite Compares
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Detailed feature comparison across leading carbon accounting platforms. We focus on transparency, audit readiness, and data quality.
          </p>
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-16">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Feature</th>
                  {competitors.map((comp) => (
                    <th
                      key={comp.slug}
                      className={`px-6 py-4 text-center font-semibold ${
                        comp.slug === "carbonsite" ? "bg-blue-50 text-blue-900" : "text-gray-900"
                      }`}
                    >
                      {comp.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((category) => (
                  <tr key={category.category}>
                    <td colSpan={6} className="px-6 py-3 bg-gray-100">
                      <span className="font-semibold text-gray-900">{category.category}</span>
                    </td>
                  </tr>
                ))}

                {features.map((category) =>
                  category.items.map((item) => (
                    <tr key={item.name} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-center bg-blue-50">
                        {item.carbonsite ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.normative ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.watershed ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.gaia ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.emitwise ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Differentiators */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-xl font-bold mb-4">CarbonSite&apos;s Unique Strengths</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Mobile field capture with OCR (no other platform offers this)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Open methodology on GitHub (reproducible and auditable)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Immutable snapshots and formula storage (audit-grade)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Transparent, usage-based pricing (vs. enterprise custom quotes)</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-xl font-bold mb-4">When to Choose CarbonSite</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>You need transparent, auditable calculations</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>Your field workers capture data (mobile OCR)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>You want predictable, transparent pricing</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>Audit readiness is a priority</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pricing Comparison */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-16">
          <h3 className="text-2xl font-bold mb-6">Pricing Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-semibold">Tier</th>
                  <th className="px-6 py-3 text-center font-semibold">CarbonSite</th>
                  <th className="px-6 py-3 text-center font-semibold">Normative</th>
                  <th className="px-6 py-3 text-center font-semibold">Watershed</th>
                  <th className="px-6 py-3 text-center font-semibold">Gaia</th>
                  <th className="px-6 py-3 text-center font-semibold">Emitwise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-6 py-3 font-medium">Startup/Pilot</td>
                  <td className="px-6 py-3 text-center">Free</td>
                  <td className="px-6 py-3 text-center text-gray-500">Not available</td>
                  <td className="px-6 py-3 text-center text-gray-500">Not available</td>
                  <td className="px-6 py-3 text-center">$5-10k/year</td>
                  <td className="px-6 py-3 text-center">Free tier</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-6 py-3 font-medium">SMB</td>
                  <td className="px-6 py-3 text-center">$50/month</td>
                  <td className="px-6 py-3 text-center text-gray-500">Not available</td>
                  <td className="px-6 py-3 text-center text-gray-500">Not available</td>
                  <td className="px-6 py-3 text-center">$15-30k/year</td>
                  <td className="px-6 py-3 text-center">$50-500/year</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-6 py-3 font-medium">Mid-Market</td>
                  <td className="px-6 py-3 text-center">$200-500/month</td>
                  <td className="px-6 py-3 text-center">$50k+/year</td>
                  <td className="px-6 py-3 text-center">$50k+/year</td>
                  <td className="px-6 py-3 text-center">$30-75k/year</td>
                  <td className="px-6 py-3 text-center">$500-5k/year</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">Enterprise</td>
                  <td className="px-6 py-3 text-center">Custom</td>
                  <td className="px-6 py-3 text-center">Custom (100k+)</td>
                  <td className="px-6 py-3 text-center">Custom (100k+)</td>
                  <td className="px-6 py-3 text-center">Custom</td>
                  <td className="px-6 py-3 text-center">Not available</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to switch?</h2>
          <p className="text-lg text-gray-600 mb-8">
            We make migration easy. Import your existing data, audit our methodology, and start publishing audit-ready reports.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
