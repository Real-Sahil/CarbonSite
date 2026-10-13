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
    <Link href={`/blog/${post.slug}`} className="group flex flex-col gap-3 rounded-[12px] border border-[#E3E8EE] bg-white p-7 transition-colors hover:border-[#131d29]/25">
      <p className="text-[13px] text-[#5B6A78]">
        <time dateTime={post.date}>{formatDate(new Date(post.date))}</time> · {post.readingTime} min read
      </p>
      <h2 className="font-display text-[24px] font-light leading-snug tracking-[-0.02em] text-[#131d29]">{post.title}</h2>
      <p className="text-[15px] leading-relaxed text-[#41505F]">{post.excerpt}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-[#c2400c]">
        Read <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
