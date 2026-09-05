import { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | CarbonSite',
  description: 'Simple, transparent pricing for carbon accounting. 30-day free trial included.',
  openGraph: {
    title: 'Pricing | CarbonSite',
    description: 'Simple, transparent pricing. 30-day free trial. No hidden fees.',
    type: 'website',
    url: 'https://carbonsite.ai/pricing',
  },
};

interface PricingTier {
  name: string;
  price: string | number;
  period?: string;
  description: string;
  cta: string;
  ctaUrl: string;
  features: Array<{ name: string; included: boolean }>;
  highlight?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '30 days free',
    period: ', then £49/month',
    description: 'For small teams getting started',
    cta: 'Start Free Trial',
    ctaUrl: '/sign-up',
    features: [
      { name: 'Up to 10 team members, 10 facilities', included: true },
      { name: 'Core Scope 1, 2 and 3 calculation', included: true },
      { name: 'Mobile app + on-device OCR field capture', included: true },
      { name: 'CSV/Excel import, audit-ready reports', included: true },
      { name: 'Email support', included: true },
      { name: 'Supplier portal', included: false },
      { name: 'Accounting software sync', included: false },
      { name: 'Invoice anomaly detection', included: false },
      { name: 'Live real-time dashboard', included: false },
      { name: 'SSO / SAML', included: false },
    ],
  },
  {
    name: 'Growth',
    price: '30 days free',
    period: ', then £149/month',
    description: 'For mid-market organizations',
    cta: 'Start Free Trial',
    ctaUrl: '/sign-up',
    highlight: true,
    features: [
      { name: 'Up to 50 team members, 50 facilities', included: true },
      { name: 'Core Scope 1, 2 and 3 calculation', included: true },
      { name: 'Mobile app + on-device OCR field capture', included: true },
      { name: 'CSV/Excel import, audit-ready reports', included: true },
      { name: 'Supplier portal', included: true },
      { name: 'Email support', included: true },
      { name: 'Accounting software sync', included: false },
      { name: 'Invoice anomaly detection', included: false },
      { name: 'Live real-time dashboard', included: false },
      { name: 'SSO / SAML', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations with advanced needs',
    cta: 'Contact Sales',
    ctaUrl: '/contact',
    features: [
      { name: 'Unlimited members, facilities and records', included: true },
      { name: 'Core Scope 1, 2 and 3 calculation', included: true },
      { name: 'Mobile app + on-device OCR field capture', included: true },
      { name: 'Supplier portal', included: true },
      { name: 'Accounting software sync (Xero, QuickBooks, Sage)', included: true },
      { name: 'Invoice anomaly detection', included: true },
      { name: 'Live real-time dashboard', included: true },
      { name: 'SSO / SAML', included: true },
      { name: 'Priority + phone support', included: true },
      { name: 'Uptime guarantee', included: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Try free for 30 days. Scale with your organization. No credit card required.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3 lg:max-w-5xl lg:mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl transition-all ${
                tier.highlight
                  ? 'border-2 border-blue-600 bg-blue-50 shadow-lg dark:border-blue-500 dark:bg-blue-950/20'
                  : 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div className="p-8">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {tier.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mt-6 flex items-baseline gap-1">
                  {tier.price !== 'Free' && tier.price !== 'Custom' && (
                    <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                      £
                    </span>
                  )}
                  <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {tier.period}
                    </span>
                  )}
                </div>

                {/* CTA Button */}
                <Link
                  href={tier.ctaUrl}
                  className={`mt-8 block w-full rounded-lg py-3 text-center font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                      : 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tier.cta}
                </Link>

                {/* Features */}
                <div className="mt-8 space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-zinc-400 dark:text-zinc-600" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included
                            ? 'text-zinc-900 dark:text-zinc-50'
                            : 'text-zinc-500 dark:text-zinc-500'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Frequently Asked Questions
        </h2>

        <div className="mt-8 space-y-6">
          {[
            {
              q: 'Can I change plans anytime?',
              a: 'Yes. After your free trial ends, you can move between Starter and Growth, or cancel anytime. No long-term contracts required.',
            },
            {
              q: 'Do you offer annual discounts?',
              a: 'Yes. Starter and Growth are 20% off when paid annually. Contact sales for Enterprise discounts.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Yes. 30-day free trial with full Growth features, including the supplier portal. No credit card required to start.',
            },
            {
              q: 'Who owns my data?',
              a: 'You do. We never sell or share data. Full export available anytime.',
            },
            {
              q: 'What’s the difference between Growth and Enterprise?',
              a: 'Growth covers core Scope 1, 2 and 3 calculation, mobile field capture, and the supplier portal. Enterprise adds accounting software sync (Xero, QuickBooks, Sage), invoice anomaly detection, the live real-time dashboard, and SSO/SAML — the back-office and IT-procurement features larger teams need.',
            },
            {
              q: 'What happens after the free trial ends?',
              a: 'Your trial expires after 30 days. You can start a paid Starter or Growth subscription to continue, or export your data and cancel.',
            },
          ].map((faq, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                {faq.q}
              </h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Ready to get started?
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Try CarbonSite free for 30 days. No credit card required.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                Start 30-Day Trial
              </Link>
              <Link
                href="/contact"
                className="rounded-lg border border-zinc-300 px-6 py-3 font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
