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
  console.log(`[getPost] Attempting to load slug: "${slug}"`);
  console.log(`[getPost] Posts directory: ${postsDirectory}`);

  if (!slug) {
    console.warn(`[getPost] Invalid slug: "${slug}"`);
    return null;
  }

  if (!fs.existsSync(postsDirectory)) {
    console.warn(`[getPost] Directory not found: ${postsDirectory}`);
    return null;
  }

  const fullPath = path.join(postsDirectory, `${slug}.mdx`);
  console.log(`[getPost] Full path: ${fullPath}`);
  console.log(`[getPost] File exists: ${fs.existsSync(fullPath)}`);

  if (!fs.existsSync(fullPath)) {
    console.warn(`[getPost] File not found: ${fullPath}`);
    // List available files for debugging
    const files = fs.readdirSync(postsDirectory).filter(f => f.endsWith('.mdx'));
    console.warn(`[getPost] Available files: ${files.slice(0, 5).join(', ')}... (total: ${files.length})`);
    return null;
  }

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const readingTime = Math.ceil(content.split(/\s+/).length / 200);

    console.log(`[getPost] Successfully loaded: ${slug}`);

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
    };
  } catch (error) {
    console.error(`[getPost] Error reading ${slug}:`, error);
    return null;
  }
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    console.warn(`[getPostSlugs] Directory not found: ${postsDirectory}`);
    return [];
  }
  const files = fs.readdirSync(postsDirectory);
  const mdxFiles = files.filter((f) => f.endsWith('.mdx'));
  const slugs = mdxFiles.map((f) => f.replace(/\.mdx?$/, ''));
  console.log(`[getPostSlugs] Directory: ${postsDirectory}`);
  console.log(`[getPostSlugs] Files found: ${files.length}`);
  console.log(`[getPostSlugs] MDX files: ${mdxFiles.length}`);
  console.log(`[getPostSlugs] Slugs: ${JSON.stringify(slugs)}`);
  return slugs;
}
