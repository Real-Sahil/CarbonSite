import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  readingTime: number;
  tags: string[];
  image?: string;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
  /// Question and answer pairs from the front matter, published as FAQPage data.
  faq: { q: string; a: string }[];
}

// Resolve blog directory path reliably in Next.js context
const POSTS_DIR = (() => {
  const cwd = process.cwd();
  const postsPath = path.join(cwd, 'content', 'blog');

  if (!fs.existsSync(postsPath)) {
    console.warn(`[Blog] Posts directory not found at ${postsPath}`);
  }

  return postsPath;
})();

const postsDirectory = POSTS_DIR;

export function getPosts(): BlogPostMeta[] {
  if (!fs.existsSync(postsDirectory)) return [];

  const fileNames = fs.readdirSync(postsDirectory).filter((f) => f.endsWith('.mdx'));
  
  return fileNames.map((fileName) => {
    const slug = fileName.replace(/\.mdx?$/, '');
    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    const readingTime = Math.ceil(content.split(/\s+/).length / 200);

    return {
      slug,
      title: data.title || slug,
      excerpt: data.excerpt || '',
      date: data.date || new Date().toISOString().split('T')[0],
      author: data.author || 'MetricOra',
      readingTime,
      tags: data.tags || [],
      image: data.image,
    };
  });
}

export function getPost(slug: string): BlogPost | null {
  if (!slug) return null;

  if (!fs.existsSync(postsDirectory)) return null;

  const fullPath = path.join(postsDirectory, `${slug}.mdx`);

  if (!fs.existsSync(fullPath)) return null;

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const readingTime = Math.ceil(content.split(/\s+/).length / 200);

    return {
      slug,
      title: data.title || slug,
      excerpt: data.excerpt || '',
      date: data.date || new Date().toISOString().split('T')[0],
      author: data.author || 'MetricOra',
      readingTime,
      tags: data.tags || [],
      image: data.image,
      content,
      faq: Array.isArray(data.faq) ? data.faq.filter((f: { q?: unknown; a?: unknown }) => typeof f?.q === 'string' && typeof f?.a === 'string') : [],
    };
  } catch (error) {
    console.error(`[getPost] Error reading ${slug}:`, error);
    return null;
  }
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  const files = fs.readdirSync(postsDirectory);
  return files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx?$/, ''));
}
