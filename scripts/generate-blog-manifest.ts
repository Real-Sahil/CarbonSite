#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

interface BlogPostManifest {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  readingTime: string;
  keywords: string[];
}

const postsDirectory = join(process.cwd(), "content", "blog");
const manifestPath = join(process.cwd(), "public", "blog-manifest.json");

function generateManifest() {
  try {
    const files = readdirSync(postsDirectory).filter((f) => f.endsWith(".mdx"));
    const posts: BlogPostManifest[] = [];

    for (const file of files) {
      const slug = file.replace(".mdx", "");
      const filePath = join(postsDirectory, file);
      const fileContents = readFileSync(filePath, "utf8");
      const { data } = matter(fileContents);

      posts.push({
        slug,
        title: data.title || slug,
        description: data.description || "",
        date: data.date || new Date().toISOString(),
        author: data.author || "MetricOra",
        readingTime: data.readingTime || "5 min read",
        keywords: data.keywords || [],
      });
    }

    // Sort by date descending
    posts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    writeFileSync(manifestPath, JSON.stringify(posts, null, 2));
    console.log(
      `✓ Generated blog manifest: ${posts.length} posts at ${manifestPath}`
    );
  } catch (error) {
    console.error("Failed to generate blog manifest:", error);
    process.exit(1);
  }
}

generateManifest();
