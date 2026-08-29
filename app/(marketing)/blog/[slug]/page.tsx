import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getBlogPost, getAllBlogPosts } from "@/lib/blog/loader";

const pillarMap: Record<string, string> = {
  "why-carbon-accounting-still-fails": "Field Operations",
  "why-carbon-accounting-fails": "Field Operations",
  "open-source-carbon-accounting": "Methodology",
  "scope-3-emissions-supplier-data": "Supply Chain",
  "anomaly-detection-carbon-data": "Field Operations",
  "building-for-audit": "Compliance",
  "building-for-audit-immutability": "Compliance",
  "carbon-accounting-at-scale": "Field Operations",
  "data-journey-field-to-finance": "Field Operations",
  "emissions-data-journey": "Field Operations",
  "supplier-carbon-data-wrong": "Supply Chain",
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getBlogPost(params.slug);
  if (!post) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    keywords: post.frontmatter.keywords,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: "article",
      publishedTime: post.frontmatter.date,
      authors: [post.frontmatter.author],
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: post.frontmatter.title,
        },
      ],
    },
  };
}

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const pillar = pillarMap[params.slug] || "Industry Insights";

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
            {post.frontmatter.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-6">
            <span>{post.frontmatter.date}</span>
            <span>{post.frontmatter.readingTime}</span>
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium">
              {pillar}
            </span>
          </div>

          <p className="text-xl text-gray-600 leading-relaxed">
            {post.frontmatter.description}
          </p>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">By {post.frontmatter.author}</p>
          </div>
        </header>

        <div className="prose prose-lg max-w-none mb-12 text-gray-700 leading-relaxed">
          <ReactMarkdown
            components={{
              h2: ({ ...props }) => <h2 className="text-2xl font-bold mt-12 mb-4" {...props} />,
              h3: ({ ...props }) => <h3 className="text-xl font-bold mt-8 mb-3" {...props} />,
              p: ({ ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
              ul: ({ ...props }) => <ul className="list-disc list-inside space-y-2 mb-4" {...props} />,
              ol: ({ ...props }) => <ol className="list-decimal list-inside space-y-2 mb-4" {...props} />,
              li: ({ ...props }) => <li className="mb-1" {...props} />,
              blockquote: ({ ...props }) => (
                <blockquote
                  className="border-l-4 border-blue-600 pl-4 italic text-gray-600 my-4"
                  {...props}
                />
              ),
              code: ({ ...props }) => (
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono" {...props} />
              ),
              pre: ({ ...props }) => (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto mb-4" {...props} />
              ),
              a: ({ ...props }) => <a className="text-blue-600 hover:text-blue-700 underline" {...props} />,
            }}
          >
            {post.content}
          </ReactMarkdown>
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
