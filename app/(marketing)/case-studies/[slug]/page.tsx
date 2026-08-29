import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const CASE_STUDIES = {
  'logistics-waste-example': {
    company: 'RegioWaste',
    industry: 'Logistics & Waste Management',
    size: '250 employees, 50 facilities across 5 regions',
    location: 'Central Europe',
    logo: '♻️',
    challenge: {
      title: 'Manual Emissions Data Entry Was Consuming 45 Hours Per Month',
      description: 'RegioWaste manages waste collection and processing across 50 facilities. Field workers photographed waste tickets manually, then office staff hand-entered the data into spreadsheets. No audit trail. No way to catch errors before they propagated.',
      metrics: [
        '45 hours/month spent on manual data entry',
        '15% of data entries had errors (typos, unit mismatches, duplicates)',
        'Auditor required proof of calculation methodology; spreadsheets didn\'t provide it',
        'Only 15% of suppliers responded to carbon data requests',
      ],
    },
    solution: {
      title: 'OCR Mobile App + Immutable Audit Trail',
      description: 'RegioWaste deployed CarbonSite on field workers\' phones. Now when a waste ticket arrives, the field worker photographs it, the app extracts weight/date/vehicle/supplier via on-device OCR (no internet needed), and it syncs automatically when back online. Every OCR extraction is logged immutably with a hash chain.',
      features: [
        'On-device OCR: Field workers photograph, app auto-extracts data',
        'Offline-first: Works in areas with no signal, syncs when reconnected',
        'Immutable audit trail: Every extraction logged with SHA-256 hash chain',
        'Anomaly detection: 8 checks catch unit mismatches, duplicates, price spikes',
        'Automated Scope 3: Supplier portal invitation sent; 12% response email vs. 64% portal',
      ],
    },
    results: {
      title: 'Results: Time Savings + Audit Ready',
      summary: '82% reduction in manual work, full audit trail immutability, zero duplicate invoices, 64% supplier participation.',
      metrics: [
        { label: 'Time saved', value: '37 hours/month', detail: '(82% reduction; down from 45h to 8h)' },
        { label: 'Data accuracy improved', value: '+89%', detail: '(15% errors down to 1.6%)' },
        { label: 'Audit preparation', value: '30 minutes', detail: '(automated compliance export vs. 8 hours manual)' },
        { label: 'Supplier participation', value: '64%', detail: '(up from 15% via email)' },
        { label: 'Duplicate invoices', value: '0', detail: '(detected & prevented by anomaly detection)' },
      ],
      quote: {
        text: 'CarbonSite cut our reporting time by 80%. Now our team can focus on actual reduction strategies instead of chasing data entry errors. The immutable audit trail gives us confidence when auditors call.',
        author: 'Sarah Nowak',
        title: 'Sustainability Lead, RegioWaste',
      },
    },
    implementation: {
      title: 'How RegioWaste Implemented It',
      steps: [
        {
          title: 'Week 1: Training & Setup',
          description: 'Trained 50 field workers on the app (15 min each). Set up org + facilities + emission categories. Connected Xero accounting API for automatic invoice data.',
        },
        {
          title: 'Week 2: Pilot (10 field workers)',
          description: 'Small pilot with high-volume waste collection sites. Verified OCR accuracy and offline sync. Made minor tweaks to category mappings.',
        },
        {
          title: 'Week 3: Full Rollout',
          description: 'All 50 field workers on the app. Set up supplier portal for top 20 vendors. Enabled anomaly detection for invoice reconciliation.',
        },
        {
          title: 'Week 4: First Audit Run',
          description: 'Committed 10k waste tickets from 3 weeks of field data. Ran calculation. Generated compliance export for auditor review. Auditor signed off in 2 hours (vs. 8 hours previous year).',
        },
      ],
    },
    advice: {
      title: 'Advice to Similar Organizations',
      points: [
        'Start with high-volume data sources (waste tickets, delivery notes) where OCR saves the most time.',
        'Make supplier participation easy: a link, no login, pre-filled forms. 64% participation proved this works.',
        'Audit trail isn\'t optional if your company is publicly traded or regulated. Immutable logs aren\'t a nice-to-have.',
        'Anomaly detection catches errors before they become audit findings. Worth the effort to configure.',
      ],
    },
  },
};

export default function CaseStudyPage({ params }: { params: { slug: string } }) {
  const caseStudy = CASE_STUDIES[params.slug as keyof typeof CASE_STUDIES];

  if (!caseStudy) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/case-studies" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold mb-4 hover:gap-3 transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back to case studies
          </Link>
          <div className="text-5xl mb-4">{caseStudy.logo}</div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
            {caseStudy.company}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">{caseStudy.industry}</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">{caseStudy.size} • {caseStudy.location}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Challenge Section */}
        <section className="mb-12 pb-12 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{caseStudy.challenge.title}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">{caseStudy.challenge.description}</p>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Key Challenges:</h3>
            <ul className="space-y-2">
              {caseStudy.challenge.metrics.map((metric, idx) => (
                <li key={idx} className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <span className="text-red-600 font-bold">•</span>
                  <span>{metric}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Solution Section */}
        <section className="mb-12 pb-12 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{caseStudy.solution.title}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">{caseStudy.solution.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caseStudy.solution.features.map((feature, idx) => (
              <div key={idx} className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
                <span className="text-slate-700 dark:text-slate-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Results Section */}
        <section className="mb-12 pb-12 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{caseStudy.results.title}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">{caseStudy.results.summary}</p>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {caseStudy.results.metrics.map((metric, idx) => (
              <div key={idx} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{metric.value}</p>
                <p className="font-semibold text-slate-900 dark:text-white">{metric.label}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{metric.detail}</p>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-6 border-l-4 border-blue-600">
            <p className="text-lg italic text-slate-700 dark:text-slate-300 mb-4">
              &quot;{caseStudy.results.quote.text}&quot;
            </p>
            <p className="font-semibold text-slate-900 dark:text-white">{caseStudy.results.quote.author}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{caseStudy.results.quote.title}</p>
          </div>
        </section>

        {/* Implementation Section */}
        <section className="mb-12 pb-12 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">{caseStudy.implementation.title}</h2>
          <div className="space-y-4">
            {caseStudy.implementation.steps.map((step, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Advice Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">{caseStudy.advice.title}</h2>
          <ul className="space-y-4">
            {caseStudy.advice.points.map((point, idx) => (
              <li key={idx} className="flex gap-4 text-slate-700 dark:text-slate-300">
                <span className="text-blue-600 font-bold flex-shrink-0">→</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Ready to get similar results?</h3>
          <p className="text-blue-100 mb-6">Schedule a demo and see how CarbonSite can transform your emissions tracking.</p>
          <a
            href="/demo"
            className="inline-block bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Schedule Demo
          </a>
        </div>
      </div>
    </div>
  );
}
