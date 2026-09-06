export interface JsonLdSchema {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export function buildOrganizationSchema(): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MetricOra',
    url: 'https://metricora.ai',
    logo: 'https://metricora.ai/logo.png',
    description: 'Carbon accounting platform for small-to-mid-market companies',
    sameAs: [
      'https://twitter.com/metricoraapp',
      'https://linkedin.com/company/metricora',
      'https://github.com/metricora/metricora',
    ],
    contact: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@metricora.ai',
      url: 'https://metricora.ai/support',
    },
  };
}

export function buildArticleSchema(article: {
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  slug: string;
}): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.headline,
    description: article.description,
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    url: `https://metricora.ai/blog/${article.slug}`,
  };
}

export function buildFaqSchema(faqs: Array<{ question: string; answer: string }>): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `https://metricora.ai${item.url}`,
    })),
  };
}
