import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { BlogCard } from "@/components/blog/BlogCard";
import { getPosts } from "@/lib/blog/posts";
import { Eyebrow, H1, Lead, Section } from "@/components/marketing/kit";

export const metadata: Metadata = withSocial({
  title: "Blog",
  description: "How MetricOra calculates, reviews and reports emissions, explained with worked examples.",
  alternates: { canonical: "/blog" },
});

export default function BlogPage() {
  const posts = getPosts().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Blog</Eyebrow>
          <H1>How the numbers are made.</H1>
          <Lead tone="dark">Worked examples of how MetricOra captures, calculates and reports emissions.</Lead>
        </div>
      </Section>
      <Section tone="paper">
        {posts.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-mk-text-2">No articles yet.</p>
        )}
      </Section>
    </>
  );
}
