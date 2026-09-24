import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPost, getPostSlugs, getPosts } from "@/lib/blog/posts";
import { formatDate } from "@/lib/utils/date";
import * as BlogComponents from "@/components/blog/BlogMdxComponents";
import Link from "next/link";
import { ClosingCta, Eyebrow, Section, TextLink } from "@/components/marketing/kit";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.excerpt, type: "article", publishedTime: post.date, authors: [post.author], url: `/blog/${post.slug}` },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "MetricOra Ltd" },
    mainEntityOfPage: `https://www.metricora.co.uk/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.metricora.co.uk/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.metricora.co.uk/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://www.metricora.co.uk/blog/${post.slug}` },
    ],
  };
  // Related reading: other posts ranked by shared tags, newest first on ties.
  const related = getPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, shared: p.tags.filter((t) => post.tags.includes(t)).length }))
    .sort((a, b) => b.shared - a.shared || b.p.date.localeCompare(a.p.date))
    .slice(0, 3)
    .map(({ p }) => p);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <Section tone="dark" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-5">
          <Eyebrow tone="dark">{post.tags[0] ?? "Article"}</Eyebrow>
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] text-balance sm:text-[48px]">{post.title}</h1>
          <p className="max-w-[62ch] text-[18px] leading-relaxed text-mk-on-dark-2">{post.excerpt}</p>
          <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-mk-on-dark-3">
            <time dateTime={post.date}>{formatDate(new Date(post.date))}</time> · {post.readingTime} min read · {post.author}
          </p>
        </div>
      </Section>
      <Section tone="light">
        <article className="mk-prose mx-auto max-w-[68ch]">
          <MDXRemote
            source={post.content}
            components={{
              Callout: BlogComponents.Callout,
              ComparisonTable: BlogComponents.ComparisonTable,
              ProofPoint: BlogComponents.ProofPoint,
              FeatureList: BlogComponents.FeatureList,
              CTABlock: BlogComponents.CTABlock,
            }}
          />
          {related.length > 0 ? (
            <nav aria-labelledby="related-heading" className="not-prose mt-12 border-t border-mk-line pt-8">
              <h2 id="related-heading" className="text-[18px] font-semibold">Related reading</h2>
              <ul className="mt-4 grid gap-4">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/blog/${r.slug}`} className="text-[16px] font-medium text-mk-accent underline-offset-4 hover:underline">
                      {r.title}
                    </Link>
                    <p className="mt-1 text-[14px] leading-relaxed text-mk-text-3">{r.excerpt}</p>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="mt-10 border-t border-mk-line pt-6">
            <TextLink href="/blog">All articles</TextLink>
          </div>
        </article>
      </Section>
      <ClosingCta title="See your own records traced this way." lead="Import a year of data in the trial and open any figure to see how it was made." />
    </>
  );
}
