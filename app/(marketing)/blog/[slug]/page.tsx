import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";

interface BlogPostMeta {
  title: string;
  description: string;
  date: string;
  author: string;
  readTime: string;
  pillar: string;
  image: string;
}

const posts: Record<string, BlogPostMeta> = {
  "why-carbon-accounting-still-fails": {
    title: "Why Carbon Accounting Still Fails: A Field Worker's Perspective",
    description: "Most carbon accounting platforms assume data is pre-cleaned and arrives from spreadsheets. The reality is messier — and that's where most errors originate.",
    date: "2026-09-01",
    author: "CarbonSite Team",
    readTime: "8 min read",
    pillar: "Field Operations",
    image: "/blog/field-workers.jpg",
  },
  "open-source-carbon-accounting": {
    title: "Open-Source Carbon Accounting: Why Transparency Matters",
    description: "Enterprise carbon platforms are black boxes. CarbonSite's open methodology means auditors can verify every calculation.",
    date: "2026-09-08",
    author: "CarbonSite Team",
    readTime: "7 min read",
    pillar: "Methodology",
    image: "/blog/transparency.jpg",
  },
  "scope3-from-silence-to-data": {
    title: "Scope 3 Emissions: From Supplier Silence to Collaborative Data",
    description: "Tier-1 suppliers won't fill out surveys. They will photograph an invoice when a field worker asks.",
    date: "2026-09-15",
    author: "CarbonSite Team",
    readTime: "8 min read",
    pillar: "Supply Chain",
    image: "/blog/supply-chain.jpg",
  },
  "anomaly-detection-carbon-data": {
    title: "Anomaly Detection in Carbon Data: Catching the Outliers",
    description: "When a facility reports 10x more waste than average, most systems send an alert. CarbonSite explains why.",
    date: "2026-09-22",
    author: "CarbonSite Team",
    readTime: "6 min read",
    pillar: "Field Operations",
    image: "/blog/anomaly-detection.jpg",
  },
  "building-for-audit": {
    title: "Building for Audit: How CarbonSite Ensures Immutability",
    description: "Carbon reports must survive auditor scrutiny. We built immutable snapshots, append-only logs, and versioned formulas.",
    date: "2026-09-29",
    author: "CarbonSite Team",
    readTime: "9 min read",
    pillar: "Compliance",
    image: "/blog/audit.jpg",
  },
  "carbon-accounting-at-scale": {
    title: "Carbon Accounting at Scale: Why Your Dashboard Feels Slow",
    description: "Most carbon platforms struggle with 100k+ record orgs. CarbonSite uses materialized views and indexed queries.",
    date: "2026-10-06",
    author: "CarbonSite Team",
    readTime: "7 min read",
    pillar: "Field Operations",
    image: "/blog/scale.jpg",
  },
  "emissions-data-journey": {
    title: "From Field to Finance: The Complete Emissions Data Journey",
    description: "Data quality issues happen at every handoff — capture to review, review to calculation, calculation to report.",
    date: "2026-10-13",
    author: "CarbonSite Team",
    readTime: "8 min read",
    pillar: "Field Operations",
    image: "/blog/data-journey.jpg",
  },
  "supplier-carbon-data-wrong": {
    title: "Why Your Supplier Carbon Data Is Wrong (And How to Fix It)",
    description: "Supplier data comes from estimates, outdated surveys, and manual entry. CarbonSite combines OCR and ML.",
    date: "2026-10-20",
    author: "CarbonSite Team",
    readTime: "8 min read",
    pillar: "Supply Chain",
    image: "/blog/supplier-data.jpg",
  },
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = posts[params.slug];
  if (!post) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      images: [
        {
          url: post.image || "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({
    slug,
  }));
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = posts[params.slug];

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAFBF8] text-[#111827] py-16">
      <article className="max-w-3xl mx-auto px-4">
        <header className="mb-12">
          <Link
            href="/blog"
            className="inline-block mb-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Blog
          </Link>

          <h1 className="text-5xl font-bold tracking-tight mb-4 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-6">
            <span>{post.date}</span>
            <span>{post.readTime}</span>
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium">
              {post.pillar}
            </span>
          </div>

          <p className="text-xl text-gray-600 leading-relaxed">
            {post.description}
          </p>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">By {post.author}</p>
          </div>
        </header>

        <div className="prose prose-lg max-w-none mb-12 text-gray-700 leading-relaxed">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded mb-8">
            <p className="text-gray-700 font-medium">
              This blog post will be populated with the full article content. The template is ready for MDX or markdown content.
            </p>
          </div>

          <h2 className="text-2xl font-bold mt-12 mb-4">Content Coming Soon</h2>
          <p>
            Each blog post will include deep dives into CarbonSite&apos;s unique approach to carbon accounting, field operations, supply chain collaboration, and regulatory compliance.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Key Takeaways</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>CarbonSite&apos;s messaging and content strategy is now documented</li>
            <li>8 blog post outlines created and ready for full content development</li>
            <li>Blog infrastructure (listing page, individual post templates, metadata) is in place</li>
            <li>All content organized by content pillar (Methodology, Field Operations, Supply Chain, Compliance, Industry Trends)</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">Next Steps</h2>
          <p>
            Full blog post content will be added incrementally. Each post will be 1,200-1,500 words with original insights, real examples, and clear calls-to-action aligned to CarbonSite&apos;s positioning as the transparent, audit-ready alternative to enterprise carbon platforms.
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="bg-blue-50 rounded-lg p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">More from CarbonSite</h3>
            <p className="text-gray-700 mb-6">
              Explore other articles on carbon accounting, emissions data quality, and supply chain transparency.
            </p>
            <Link
              href="/blog"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              View All Posts
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
