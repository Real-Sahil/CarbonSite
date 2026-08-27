/**
 * Open Graph tag generator for social sharing (Facebook, LinkedIn, Twitter)
 */

export interface OGMetadata {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'blog';
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

export function generateOGTags(metadata: OGMetadata): Record<string, string> {
  return {
    'og:title': metadata.title,
    'og:description': metadata.description,
    'og:url': metadata.url,
    'og:type': metadata.type || 'website',
    'og:image': metadata.image || 'https://carbonsite.app/og-default.png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': metadata.title,
    'og:site_name': 'CarbonSite',
    'og:locale': 'en_US',

    // Twitter Card tags (X/Twitter specific)
    'twitter:card': 'summary_large_image',
    'twitter:title': metadata.title,
    'twitter:description': metadata.description,
    'twitter:image': metadata.image || 'https://carbonsite.app/og-default.png',
    'twitter:creator': '@CarbonSiteApp',
    'twitter:site': '@CarbonSiteApp',

    // Additional metadata
    'article:author': metadata.author || 'CarbonSite',
    'article:published_time': metadata.publishedAt || new Date().toISOString(),
    'article:modified_time': metadata.updatedAt || new Date().toISOString(),
  };
}

export function generateTwitterCard(metadata: OGMetadata) {
  return {
    card: 'summary_large_image',
    title: metadata.title,
    description: metadata.description,
    image: metadata.image || 'https://carbonsite.app/og-default.png',
    creator: '@CarbonSiteApp',
  };
}

/**
 * Generate <meta> tags HTML string for server-side rendering
 */
export function metaTagsToHTML(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => {
      if (key.startsWith('og:') || key.startsWith('twitter:') || key.startsWith('article:')) {
        return `<meta property="${key}" content="${escapeHTML(value)}" />`;
      }
      return `<meta name="${key}" content="${escapeHTML(value)}" />`;
    })
    .join('\n');
}

function escapeHTML(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Generate Next.js Metadata object
 */
export function generateMetadata(metadata: OGMetadata) {
  return {
    title: metadata.title,
    description: metadata.description,
    url: metadata.url,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: metadata.url,
      type: metadata.type || 'website',
      images: [
        {
          url: metadata.image || 'https://carbonsite.app/og-default.png',
          width: 1200,
          height: 630,
          alt: metadata.title,
        },
      ],
      siteName: 'CarbonSite',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: metadata.title,
      description: metadata.description,
      images: [metadata.image || 'https://carbonsite.app/og-default.png'],
      creator: '@CarbonSiteApp',
    },
  };
}
