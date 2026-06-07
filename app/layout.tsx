import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarbonSite | GHG Emissions Tracking",
  description:
    "Multi-tenant GHG emissions tracking platform for small-to-mid-market companies. Import activity data, run calculations, and generate audit-ready reports.",
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
