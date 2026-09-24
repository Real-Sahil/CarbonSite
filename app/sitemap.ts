import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/blog/posts";

const BASE = "https://www.metricora.co.uk";

// Every public marketing page. Keep in step with app/(marketing).
const PAGES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, freq: "weekly" },
  { path: "/product", priority: 0.9, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "monthly" },
  { path: "/field-app", priority: 0.8, freq: "monthly" },
  { path: "/solutions/construction", priority: 0.8, freq: "monthly" },
  { path: "/solutions/waste-haulage", priority: 0.8, freq: "monthly" },
  { path: "/solutions/public-sector", priority: 0.8, freq: "monthly" },
  { path: "/methodology", priority: 0.7, freq: "monthly" },
  { path: "/security", priority: 0.7, freq: "monthly" },
  { path: "/resources", priority: 0.6, freq: "monthly" },
  { path: "/developer", priority: 0.5, freq: "monthly" },
  { path: "/blog", priority: 0.6, freq: "weekly" },
  { path: "/contact", priority: 0.6, freq: "yearly" },
  { path: "/privacy", priority: 0.2, freq: "yearly" },
  { path: "/terms", priority: 0.2, freq: "yearly" },
  { path: "/cookies", priority: 0.2, freq: "yearly" },
  { path: "/dpa", priority: 0.2, freq: "yearly" },
  { path: "/acceptable-use", priority: 0.2, freq: "yearly" },
  { path: "/eula", priority: 0.2, freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts0 = getPosts();
  // The newest article date stands in for the site's last content change.
  const latest = posts0.reduce((d, p) => (p.date > d ? p.date : d), "2026-09-24");
  const pages = PAGES.map((p) => ({ url: `${BASE}${p.path}`, lastModified: latest, changeFrequency: p.freq, priority: p.priority }));
  const posts = posts0.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));
  return [...pages, ...posts];
}
