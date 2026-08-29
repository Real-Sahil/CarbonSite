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

const postsDirectory = path.join(process.cwd(), 'content/blog');

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
      author: data.author || 'CarbonSite',
      readingTime,
      tags: data.tags || [],
      image: data.image,
    };
  });
}

export function getPost(slug: string): BlogPost | null {
  if (!fs.existsSync(postsDirectory)) return null;

  const fullPath = path.join(postsDirectory, `${slug}.mdx`);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  const readingTime = Math.ceil(content.split(/\s+/).length / 200);

  return {
    slug,
    title: data.title || slug,
    excerpt: data.excerpt || '',
    date: data.date || new Date().toISOString().split('T')[0],
    author: data.author || 'CarbonSite',
    readingTime,
    tags: data.tags || [],
    image: data.image,
    content,
  };
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs.readdirSync(postsDirectory)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx?$/, ''));
}
