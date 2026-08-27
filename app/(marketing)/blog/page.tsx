import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CarbonSite Blog",
  description: "Insights on carbon accounting, supply chain transparency, and emissions data quality.",
  openGraph: {
    title: "CarbonSite Blog",
    description: "Insights on carbon accounting, supply chain transparency, and emissions data quality.",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "CarbonSite Blog",
      },
    ],
  },
};

const posts = [
  {
    slug: "why-carbon-accounting-still-fails",
    title: "Why Carbon Accounting Still Fails: A Field Worker's Perspective",
    excerpt: "Most carbon accounting platforms assume data is pre-cleaned and arrives from spreadsheets. The reality is messier — and that's where most errors originate.",
    author: "CarbonSite",
    date: "2026-09-01",
    readTime: "8 min read",
    pillar: "Field Operations",
    tags: ["data-quality", "field-capture", "ocr"],
  },
  {
    slug: "open-source-carbon-accounting",
    title: "Open-Source Carbon Accounting: Why Transparency Matters",
    excerpt: "Enterprise carbon platforms are black boxes. CarbonSite's open methodology means auditors can verify every calculation. Here's why that matters.",
    author: "CarbonSite",
    date: "2026-09-08",
    readTime: "7 min read",
    pillar: "Methodology",
    tags: ["transparency", "audit", "methodology"],
  },
  {
    slug: "scope3-from-silence-to-data",
    title: "Scope 3 Emissions: From Supplier Silence to Collaborative Data",
    excerpt: "Tier-1 suppliers won't fill out surveys. They will photograph an invoice when a field worker asks. Scope 3 is not a survey problem — it's an operational one.",
    author: "CarbonSite",
    date: "2026-09-15",
    readTime: "8 min read",
    pillar: "Supply Chain",
    tags: ["scope3", "supply-chain", "collaboration"],
  },
  {
    slug: "anomaly-detection-carbon-data",
    title: "Anomaly Detection in Carbon Data: Catching the Outliers",
    excerpt: "When a facility reports 10x more waste than average, most systems send an alert. CarbonSite explains why it happened. Anomaly detection is not a flag — it's an investigation tool.",
    author: "CarbonSite",
    date: "2026-09-22",
    readTime: "6 min read",
    pillar: "Field Operations",
    tags: ["anomaly-detection", "ml", "data-quality"],
  },
  {
    slug: "building-for-audit",
    title: "Building for Audit: How CarbonSite Ensures Immutability",
    excerpt: "Carbon reports must survive auditor scrutiny. We built immutable snapshots, append-only logs, and versioned formulas so every number is traceable and defensible.",
    author: "CarbonSite",
    date: "2026-09-29",
    readTime: "9 min read",
    pillar: "Compliance",
    tags: ["audit", "immutability", "versioning"],
  },
  {
    slug: "carbon-accounting-at-scale",
    title: "Carbon Accounting at Scale: Why Your Dashboard Feels Slow",
    excerpt: "Most carbon platforms struggle with 100k+ record orgs. CarbonSite uses materialized views, incremental aggregation, and indexed queries to stay fast.",
    author: "CarbonSite",
    date: "2026-10-06",
    readTime: "7 min read",
    pillar: "Field Operations",
    tags: ["performance", "scale", "architecture"],
  },
  {
    slug: "emissions-data-journey",
    title: "From Field to Finance: The Complete Emissions Data Journey",
    excerpt: "Data quality issues happen at every handoff — capture to review, review to calculation, calculation to report. We designed CarbonSite to catch errors at each stage.",
    author: "CarbonSite",
    date: "2026-10-13",
    readTime: "8 min read",
    pillar: "Field Operations",
    tags: ["data-pipeline", "workflow", "quality"],
  },
  {
    slug: "supplier-carbon-data-wrong",
    title: "Why Your Supplier Carbon Data Is Wrong (And How to Fix It)",
    excerpt: "Supplier data comes from estimates, outdated surveys, and manual entry. CarbonSite combines OCR, ML estimation, and anomaly detection to bring accuracy to Scope 3.",
    author: "CarbonSite",
    date: "2026-10-20",
    readTime: "8 min read",
    pillar: "Supply Chain",
    tags: ["scope3", "supplier-data", "ml"],
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAFBF8] text-[#111827] py-16">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-4">CarbonSite Blog</h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
            Insights on carbon accounting, supply chain transparency, field operations, and emissions data quality. Learn how to build defensible carbon reports that survive auditor scrutiny.
          </p>
        </div>

        <div className="space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="border-b border-gray-200 pb-8 hover:bg-white/50 p-4 rounded-lg transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group block mb-2"
                  >
                    <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                      {post.title}
                    </h2>
                  </Link>

                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>{post.date}</span>
                    <span>{post.readTime}</span>
                    <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {post.pillar}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-block text-blue-600 hover:text-blue-700 font-medium text-sm whitespace-nowrap mt-2"
                >
                  Read →
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 p-8 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscribe to Updates</h3>
          <p className="text-gray-600 mb-4">
            Get new insights on carbon accounting, emissions data, and supply chain transparency delivered to your inbox.
          </p>
          <form className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-2 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
