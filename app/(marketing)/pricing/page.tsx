import { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { PLAN_ANNUAL_TOTAL, PLAN_PRICES } from '@/lib/billing/limits';

export const metadata: Metadata = {
  title: 'Pricing | MetricOra',
  description: 'Simple, transparent pricing for carbon accounting. 30-day free trial included.',
  openGraph: {
    title: 'Pricing | MetricOra',
    description: 'Simple, transparent pricing. 30-day free trial. No hidden fees.',
    type: 'website',
    url: 'https://metricora.co.uk/pricing',
  },
};

interface PricingTier {
  name: string;
  /** Monthly price in GBP excluding VAT, or a label for sales-led plans. */
  price: number | string;
  period?: string;
  note?: string;
  description: string;
  cta: string;
  ctaUrl: string;
  features: Array<{ name: string; included: boolean }>;
  highlight?: boolean;
}

// Prices match PLAN_PRICES / PLAN_ANNUAL_TOTAL in lib/billing/limits.ts.
const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: PLAN_PRICES.starter.monthly,
    period: '/month + VAT',
    note: `or £${PLAN_ANNUAL_TOTAL.starter.toLocaleString('en-GB')}/year, 2 months free`,
    description: 'SECR and Carbon Reduction Plans for bids',
    cta: 'Start 30-day free trial',
    ctaUrl: '/sign-up',
    features: [
      { name: 'Up to 3 sites and 5 web users', included: true },
      { name: 'Unlimited field workers on the mobile app', included: true },
      { name: 'Scope 1, 2 and 3 with DEFRA, EPA and ADEME factors', included: true },
      { name: 'GHG Protocol, SECR and PPN 06/21 reports with auditor CSV trail', included: true },
      { name: 'Email support', included: true },
      { name: 'Social value (TOMs) reporting', included: false },
      { name: 'Bid carbon pack and PAS 2080', included: false },
      { name: 'Accounting sync (Xero, QuickBooks, Sage)', included: false },
      { name: 'SSO / SAML', included: false },
    ],
  },
  {
    name: 'Growth',
    price: PLAN_PRICES.growth.monthly,
    period: '/month + VAT',
    note: `or £${PLAN_ANNUAL_TOTAL.growth.toLocaleString('en-GB')}/year, 2 months free`,
    description: 'For contractors bidding for public work every month',
    cta: 'Start 30-day free trial',
    ctaUrl: '/sign-up',
    highlight: true,
    features: [
      { name: 'Up to 15 sites or contracts and 25 web users', included: true },
      { name: 'Unlimited field workers and supplier portal logins', included: true },
      { name: 'Everything in Starter', included: true },
      { name: 'Social value (TOMs) reporting', included: true },
      { name: 'Bid carbon pack, PAS 2080 and project carbon budgets', included: true },
      { name: 'Accounting sync (Xero, QuickBooks, Sage)', included: true },
      { name: 'Priority support and an onboarding call', included: true },
      { name: 'SSO / SAML', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: `From £${PLAN_PRICES.enterprise.monthly}`,
    period: '/month',
    note: 'Billed annually by invoice',
    description: 'For groups with many sites and IT requirements',
    cta: 'Contact sales',
    ctaUrl: '/contact',
    features: [
      { name: 'Unlimited sites, entities and users', included: true },
      { name: 'Everything in Growth', included: true },
      { name: 'SSO / SAML and API access', included: true },
      { name: 'Invoice anomaly detection', included: true },
      { name: 'Live real-time dashboard', included: true },
      { name: 'Assurance-ready evidence packs', included: true },
      { name: 'Named contact and priority support', included: true },
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
                  {typeof tier.price === 'number' && (
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

                {tier.note && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{tier.note}</p>
                )}

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
              a: 'Yes. Paying yearly for Starter or Growth gets you 2 months free. Enterprise is billed annually.',
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
              a: 'Growth covers up to 15 sites with social value, bid carbon packs, PAS 2080 and accounting sync. Enterprise removes the limits and adds SSO, API access, invoice anomaly detection and the live dashboard, the features larger groups and their IT teams need.',
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
              Try MetricOra free for 30 days. No credit card required.
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
