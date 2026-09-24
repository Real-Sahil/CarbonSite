import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  readingTime: number;
  tags: string[];
  image?: string;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col gap-3 rounded-[12px] border border-mk-line bg-mk-surface p-7 transition-colors hover:border-mk-text/30">
      <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-mk-text-3">
        <time dateTime={post.date}>{formatDate(new Date(post.date))}</time> · {post.readingTime} min read
      </p>
      <h2 className="text-[20px] font-semibold leading-snug tracking-[-0.01em] text-mk-text">{post.title}</h2>
      <p className="text-[15px] leading-relaxed text-mk-text-2">{post.excerpt}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-mk-accent">
        Read <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
