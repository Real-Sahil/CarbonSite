import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getPost, getPostSlugs } from '@/lib/blog/posts';
import { formatDate } from '@/lib/utils/date';
import * as BlogComponents from '@/components/blog/BlogMdxComponents';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost(params.slug);
  if (!post) return {};

  return {
    title: `${post.title} | CarbonSite Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `https://carbonsite.ai/blog/${post.slug}`,
      images: post.image ? [{ url: post.image }] : [],
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getPost(params.slug);

  if (!post) {
    notFound();
  }

  const components = {
    Callout: BlogComponents.Callout,
    ComparisonTable: BlogComponents.ComparisonTable,
    ProofPoint: BlogComponents.ProofPoint,
    FeatureList: BlogComponents.FeatureList,
    CTABlock: BlogComponents.CTABlock,
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Article Header */}
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link 
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to blog
        </Link>

        {/* Title and Meta */}
        <header className="mb-8">
          <h1 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <time dateTime={post.date}>{formatDate(new Date(post.date))}</time>
            <span>•</span>
            <span>{post.readingTime} min read</span>
            {post.author && (
              <>
                <span>•</span>
                <span>By {post.author}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Featured Image */}
        {post.image && (
          <div className="mb-8 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <img
              src={post.image}
              alt={post.title}
              className="h-96 w-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-zinc max-w-none dark:prose-invert">
          <MDXRemote source={post.content} components={components} />
        </div>

        {/* Article Footer */}
        <footer className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{post.author}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Carbon accounting & sustainability expert
              </p>
            </div>
            <Link
              href="/pricing"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              Try CarbonSite
            </Link>
          </div>
        </footer>
      </article>

      {/* Related Posts */}
      <section className="border-t border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50">More from the blog</h2>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Read all posts →
          </Link>
        </div>
      </section>
    </div>
  );
}
