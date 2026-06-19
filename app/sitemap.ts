import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/product",
  "/solutions/construction",
  "/solutions/waste-haulage",
  "/field-app",
  "/security",
  "/resources",
  "/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
