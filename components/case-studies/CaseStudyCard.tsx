import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CaseStudyCardProps {
  slug: string;
  company: string;
  industry: string;
  logo: string;
  challenge: string;
  solution: string;
  result: string;
  featured?: boolean;
}

export function CaseStudyCard({
  slug,
  company,
  industry,
  logo,
  challenge,
  solution,
  result,
  featured,
}: CaseStudyCardProps) {
  return (
    <Link href={`/case-studies/${slug}`}>
      <div className={`group h-full rounded-lg border-2 transition-all hover:shadow-lg hover:border-blue-400 cursor-pointer ${
        featured
          ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-950'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}>
        <div className="p-6">
          {/* Logo & Company */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-4xl mb-2">{logo}</div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{company}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{industry}</p>
            </div>
            {featured && (
              <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Featured
              </span>
            )}
          </div>

          {/* Challenge */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Challenge</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{challenge}</p>
          </div>

          {/* Solution */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Solution</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{solution}</p>
          </div>

          {/* Result */}
          <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Result</h4>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-2">{result}</p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm group-hover:gap-3 transition-all">
            Read full case study
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
