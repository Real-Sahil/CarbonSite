import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report Verification — MetricOra',
  description: 'Verify the integrity and authenticity of your GHG emissions report using QR code validation.',
  robots: 'noindex, nofollow',
};

export default function ReportVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
