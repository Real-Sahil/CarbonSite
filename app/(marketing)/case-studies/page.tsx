import { CaseStudyCard } from '@/components/case-studies/CaseStudyCard';

const CASE_STUDIES = [
  {
    slug: 'logistics-waste-example',
    company: 'RegioWaste (Example)',
    industry: 'Logistics & Waste Management',
    logo: '♻️',
    challenge: 'Field workers manually entering waste ticket data, 45 hours/month on data entry, no audit trail',
    solution: 'Mobile app with automatic data capture + offline sync, automated anomaly detection',
    result: '82% reduction in manual work (8 hours/month), 100% audit trail immutability, 0 duplicate invoices',
    metrics: [
      { label: 'Time saved', value: '37 hours/month' },
      { label: 'Data accuracy', value: '+89%' },
      { label: 'Audit preparation', value: '30 minutes' },
    ],
    featured: true,
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-12 md:py-16">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Customer Case Studies
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            See how companies like yours use CarbonSite to streamline emissions tracking, reduce manual work, and pass audits with confidence.
          </p>
        </div>
      </div>

      {/* Case Studies Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CASE_STUDIES.map(study => (
            <CaseStudyCard key={study.slug} {...study} />
          ))}
        </div>

        {/* More Coming Soon */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">More coming soon</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We&apos;re documenting case studies across waste management, logistics, manufacturing, and retail. Check back soon or contact us to share your story.
          </p>
          <a
            href="/demo"
            className="inline-block bg-blue-600 text-white hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Schedule Demo
          </a>
        </div>
      </div>
    </div>
  );
}
