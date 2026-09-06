import { MetadataRoute } from 'next';

// Import blog post utility if available
const BLOG_POSTS = [
  { slug: 'field-workers-carbon-accounting', date: '2026-01-15' },
  { slug: 'open-source-transparency', date: '2026-01-22' },
  { slug: 'scope3-supplier-collaboration', date: '2026-01-29' },
  { slug: 'anomaly-detection-carbon', date: '2026-02-05' },
  { slug: 'audit-immutability-architecture', date: '2026-02-12' },
  { slug: 'performance-at-scale', date: '2026-02-19' },
  { slug: 'data-journey-field-to-finance', date: '2026-02-26' },
  { slug: 'supplier-data-quality-fix', date: '2026-03-05' },
];

const CASE_STUDIES = [
  { slug: 'logistics-waste-example', date: '2026-03-01' },
];

const STATIC_PAGES = [
  { url: '', changefreq: 'weekly', priority: 1.0 },
  { url: '/pricing', changefreq: 'monthly', priority: 0.9 },
  { url: '/comparison', changefreq: 'monthly', priority: 0.9 },
  { url: '/blog', changefreq: 'daily', priority: 0.8 },
  { url: '/case-studies', changefreq: 'monthly', priority: 0.8 },
  { url: '/features', changefreq: 'monthly', priority: 0.7 },
  { url: '/about', changefreq: 'monthly', priority: 0.7 },
  { url: '/contact', changefreq: 'yearly', priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://metricora.co.uk';

  // Static pages
  const staticEntries = STATIC_PAGES.map(page => ({
    url: `${baseUrl}${page.url}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: page.changefreq as 'weekly' | 'monthly' | 'daily' | 'yearly',
    priority: page.priority,
  }));

  // Blog posts
  const blogEntries = BLOG_POSTS.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Case studies
  const caseStudyEntries = CASE_STUDIES.map(study => ({
    url: `${baseUrl}/case-studies/${study.slug}`,
    lastModified: study.date,
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }));

  return [...staticEntries, ...blogEntries, ...caseStudyEntries];
}
