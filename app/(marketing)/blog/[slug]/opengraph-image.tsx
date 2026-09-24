import { ImageResponse } from "next/og";
import { getPost, getPostSlugs } from "@/lib/blog/posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MetricOra article";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

// Share image per article: title on the graphite ground with the ember rule.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B100E", padding: 72, color: "#F3F5F2", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#B4BFBA" }}>
          <div style={{ width: 40, height: 6, background: "#C2410C" }} />
          MetricOra · {post?.tags[0] ?? "Article"}
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>{post?.title ?? "MetricOra"}</div>
        <div style={{ display: "flex", fontSize: 26, color: "#B4BFBA" }}>metricora.co.uk/blog</div>
      </div>
    ),
    size,
  );
}
