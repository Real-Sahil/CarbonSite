import { Metadata } from 'next';
import { BlogCard, type BlogPost } from '@/components/blog/BlogCard';
import { getPosts } from '@/lib/blog/posts';

export const metadata: Metadata = {
  title: 'Blog | MetricOra',
  description: 'Insights on carbon accounting, field operations, supply chain collaboration, and compliance readiness.',
  openGraph: {
    title: 'Blog | MetricOra',
    description: 'Thoughts on carbon accounting and sustainability.',
    type: 'website',
    url: 'https://metricora.co.uk/blog',
  },
};

export default function BlogPage() {
  const posts = getPosts();
  const sortedPosts = posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">Blog</h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Insights on carbon accounting, field operations, supply chain collaboration, and compliance.
          </p>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {sortedPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>

        {sortedPosts.length === 0 && (
          <div className="text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No posts yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
