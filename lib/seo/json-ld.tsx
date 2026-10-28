import type { Metadata } from "next";

const SITE = "https://www.metricora.co.uk";

type PageType = "WebPage" | "ContactPage" | "AboutPage";

/// Structured data for a marketing page: a WebPage that belongs to the
/// MetricOra site, plus a breadcrumb trail. Title, description and path come
/// from the page's own `metadata`, so the two cannot drift apart.
export function PageJsonLd({ meta, type = "WebPage" }: { meta: Metadata; type?: PageType }) {
  const path = typeof meta.alternates?.canonical === "string" ? meta.alternates.canonical : "/";
  const url = `${SITE}${path}`;
  const og = meta.openGraph?.title;
  const name = typeof og === "string" ? og : typeof meta.title === "string" ? meta.title : "MetricOra";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": type,
        "@id": `${url}#webpage`,
        url,
        name,
        description: typeof meta.description === "string" ? meta.description : undefined,
        inLanguage: "en-GB",
        isPartOf: { "@type": "WebSite", name: "MetricOra", url: SITE },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: name.replace(/ \| MetricOra$/, ""), item: url },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
