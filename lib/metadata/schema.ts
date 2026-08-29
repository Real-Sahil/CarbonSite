/**
 * JSON-LD Schema.org generators for rich snippets (Google Search)
 */

export interface BlogPostSchema {
  title: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  url: string;
  wordCount?: number;
}

export interface FAQSchema {
  question: string;
  answer: string;
}

export interface OrganizationSchema {
  name: string;
  logo?: string;
  url: string;
  sameAs?: string[];
  foundingDate?: string;
  description?: string;
}

export interface ProductSchema {
  name: string;
  description: string;
  image?: string;
  price: string;
  priceCurrency?: string;
  availability?: string;
  rating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

/**
 * Generate BlogPosting schema for blog posts
 */
export function generateBlogPostSchema(post: BlogPostSchema): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: post.image,
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    author: {
      '@type': 'Organization',
      name: post.author,
      url: 'https://carbonsite.app',
    },
    publisher: {
      '@type': 'Organization',
      name: 'CarbonSite',
      logo: {
        '@type': 'ImageObject',
        url: 'https://carbonsite.app/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.url,
    },
    wordCount: post.wordCount || 1200,
  };
}

/**
 * Generate FAQPage schema for FAQ sections
 */
export function generateFAQSchema(faqs: FAQSchema[]): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate Organization schema
 */
export function generateOrganizationSchema(org: OrganizationSchema): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo || 'https://carbonsite.app/logo.png',
    description: org.description || 'Carbon emissions accounting platform',
    sameAs: org.sameAs || [
      'https://twitter.com/CarbonSiteApp',
      'https://linkedin.com/company/carbonsite',
      'https://github.com/real-sahil/carbonsite',
    ],
    foundingDate: org.foundingDate,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Sales',
      url: 'https://carbonsite.app/contact',
      email: 'sales@carbonsite.app',
    },
  };
}

/**
 * Generate Product schema (for pricing page)
 */
export function generateProductSchema(product: ProductSchema): Record<string, any> {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.priceCurrency || 'GBP',
      availability: product.availability || 'https://schema.org/InStock',
      url: 'https://carbonsite.app/pricing',
    },
  };

  if (product.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating.ratingValue,
      reviewCount: product.rating.reviewCount,
    };
  }

  return schema;
}

/**
 * Generate BreadcrumbList schema (for navigation)
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Convert schema to JSON-LD script tag HTML string
 */
export function schemaToScriptTag(schema: Record<string, any>): string {
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/**
 * Batch schema generator for multiple schemas on one page
 */
export function generateMultipleSchemas(...schemas: Record<string, any>[]): string {
  if (schemas.length === 1) {
    return schemaToScriptTag(schemas[0]);
  }

  // For multiple schemas, wrap in @graph
  return schemaToScriptTag({
    '@context': 'https://schema.org',
    '@graph': schemas,
  });
}
