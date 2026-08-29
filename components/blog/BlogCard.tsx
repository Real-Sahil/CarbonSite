import Link from 'next/link';
import { formatDate } from '@/lib/utils/date';

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
    <Link href={`/blog/${post.slug}`}>
      <article className="group flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 transition-all hover:border-blue-500 hover:shadow-md dark:border-zinc-800 dark:hover:border-blue-500">
        {post.image && (
          <div className="aspect-video w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
            <img 
              src={post.image} 
              alt={post.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <span 
                key={tag}
                className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
          
          <h3 className="text-lg font-semibold text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
            {post.title}
          </h3>
          
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {post.excerpt}
          </p>
        </div>
        
        <div className="flex items-center gap-4 pt-2 text-xs text-zinc-500 dark:text-zinc-500">
          <span>{formatDate(new Date(post.date))}</span>
          <span>•</span>
          <span>{post.readingTime} min read</span>
          {post.author && (
            <>
              <span>•</span>
              <span>{post.author}</span>
            </>
          )}
        </div>
      </article>
    </Link>
  );
}
