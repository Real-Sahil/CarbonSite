import { Metadata } from 'next';

export interface OpenGraphConfig {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  publishedDate?: string;
  authors?: string[];
  url?: string;
}

export function buildOpenGraphMetadata(config: OpenGraphConfig): Partial<Metadata> {
  return {
    title: config.title,
    description: config.description,
    openGraph: {
      title: config.title,
      description: config.description,
      images: [
        {
          url: config.image || '/og-default.jpg',
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
      type: config.type === 'article' ? 'article' : 'website',
      ...(config.type === 'article' && config.publishedDate && {
        publishedTime: config.publishedDate,
        authors: config.authors || ['MetricOra'],
      }),
      url: config.url,
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: [config.image || '/og-default.jpg'],
      creator: '@metricoraapp',
    },
  };
}

export function buildBlogPostMetadata(config: {
  title: string;
  description: string;
  image?: string;
  publishedDate?: string;
  author?: string;
  slug: string;
}): Partial<Metadata> {
  return buildOpenGraphMetadata({
    ...config,
    type: 'article',
    authors: config.author ? [config.author] : undefined,
    url: `/blog/${config.slug}`,
  });
}
