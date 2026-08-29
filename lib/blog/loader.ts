import { readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

export interface BlogPostFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  readingTime: string;
  keywords: string[];
  slug: string;
}

export interface BlogPost {
  frontmatter: BlogPostFrontmatter;
  content: string;
  slug: string;
}

const postsDirectory = join(process.cwd(), "content", "blog");

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const filePath = join(postsDirectory, `${slug}.mdx`);
    const fileContents = readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      frontmatter: data as BlogPostFrontmatter,
      content,
      slug,
    };
  } catch (error) {
    return null;
  }
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    const fs = await import("fs/promises");
    const files = await fs.readdir(postsDirectory);
    const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

    const posts = await Promise.all(
      mdxFiles.map(async (file) => {
        const slug = file.replace(".mdx", "");
        return getBlogPost(slug);
      })
    );

    return posts.filter((post) => post !== null) as BlogPost[];
  } catch (error) {
    return [];
  }
}
