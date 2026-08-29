export interface JsonLdSchema {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export function buildOrganizationSchema(): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CarbonSite',
    url: 'https://carbonsite.ai',
    logo: 'https://carbonsite.ai/logo.png',
    description: 'Carbon accounting platform for small-to-mid-market companies',
    sameAs: [
      'https://twitter.com/carbonsiteapp',
      'https://linkedin.com/company/carbonsite',
      'https://github.com/carbonsite/carbonsite',
    ],
    contact: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@carbonsite.ai',
      url: 'https://carbonsite.ai/support',
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
    url: `https://carbonsite.ai/blog/${article.slug}`,
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
      item: `https://carbonsite.ai${item.url}`,
    })),
  };
}
