import type { Metadata } from "next";

const OG_IMAGE = { url: "/og-default.png", width: 1200, height: 630, alt: "MetricOra" };

/// Adds OpenGraph and Twitter tags that match the page's own title,
/// description and canonical path. Without them every marketing page is
/// shared with the root layout's home-page title.
export function withSocial(meta: Metadata): Metadata {
  const raw = meta.title;
  const title =
    typeof raw === "string" ? `${raw} | MetricOra` : raw && typeof raw === "object" && "absolute" in raw ? raw.absolute : undefined;
  const description = meta.description ?? undefined;
  const url = typeof meta.alternates?.canonical === "string" ? meta.alternates.canonical : undefined;
  return {
    ...meta,
    openGraph: { type: "website", siteName: "MetricOra", locale: "en_GB", title, description, url, images: [OG_IMAGE], ...meta.openGraph },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url], ...meta.twitter },
  };
}
