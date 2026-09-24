import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPost, getPostSlugs } from "@/lib/blog/posts";
import { formatDate } from "@/lib/utils/date";
import * as BlogComponents from "@/components/blog/BlogMdxComponents";
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
    openGraph: { title: post.title, description: post.excerpt, type: "article", publishedTime: post.date, authors: [post.author] },
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
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          <div className="mt-12 border-t border-mk-line pt-6">
            <TextLink href="/blog">All articles</TextLink>
          </div>
        </article>
      </Section>
      <ClosingCta title="See your own records traced this way." lead="Import a year of data in the trial and open any figure to see how it was made." />
    </>
  );
}
