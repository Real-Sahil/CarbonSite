import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/product",
          "/solutions/construction",
          "/solutions/waste-haulage",
          "/field-app",
          "/security",
          "/resources",
          "/contact",
        ],
        disallow: [
          "/api/",
          "/app",
          "/invite/",
          "/orgs/",
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
