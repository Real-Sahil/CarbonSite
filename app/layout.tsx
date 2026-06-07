import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite.app"),
  title: {
    default: "CarbonSite | Construction Carbon Reporting",
    template: "%s | CarbonSite",
  },
  description:
    "Audit-ready carbon reporting for UK construction materials, waste collections, and haulage routes.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/favicon.svg" }],
  },
  openGraph: {
    title: "CarbonSite",
    description:
      "Materials, waste and haulage evidence in one audit-ready construction carbon workspace.",
    url: "/",
    siteName: "CarbonSite",
    images: [{ url: "/carbonsite-site-operations.svg", width: 960, height: 620 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarbonSite",
    description:
      "Audit-ready carbon reporting for UK construction materials, waste and haulage.",
    images: ["/carbonsite-site-operations.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
