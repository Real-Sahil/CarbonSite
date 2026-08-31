import { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | CarbonSite',
  description: 'Simple, transparent pricing for carbon accounting. Free tier included.',
  openGraph: {
    title: 'Pricing | CarbonSite',
    description: 'Simple, transparent pricing. No hidden fees.',
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
    price: 'Free',
    description: 'Perfect for pilots and startups',
    cta: 'Get Started',
    ctaUrl: '/auth/signup',
    features: [
      { name: 'Up to 100 emissions records', included: true },
      { name: '1 facility', included: true },
      { name: '1 reporting period', included: true },
      { name: 'Core calculation engine', included: true },
      { name: 'Community support', included: true },
      { name: 'Mobile app for field teams', included: false },
      { name: 'Supplier portal', included: false },
      { name: 'Accounting software integration', included: false },
      { name: 'Live dashboard', included: false },
      { name: 'Enterprise security', included: false },
      { name: 'Uptime guarantee', included: false },
    ],
  },
  {
    name: 'Growth',
    price: 50,
    period: '/month',
    description: 'For mid-market organizations',
    cta: 'Start Free Trial',
    ctaUrl: '/auth/signup',
    highlight: true,
    features: [
      { name: 'Up to 10,000 emissions records', included: true },
      { name: 'Unlimited facilities', included: true },
      { name: 'Unlimited reporting periods', included: true },
      { name: 'Core + Scope 3 calculation', included: true },
      { name: 'Email support', included: true },
      { name: 'Mobile app for field teams', included: true },
      { name: 'Supplier portal', included: true },
      { name: 'Accounting software integration', included: true },
      { name: 'Live dashboard', included: true },
      { name: 'Anomaly detection', included: true },
      { name: 'Uptime guarantee', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations with advanced needs',
    cta: 'Contact Sales',
    ctaUrl: '/contact-sales',
    features: [
      { name: 'Unlimited records & facilities', included: true },
      { name: 'Unlimited users', included: true },
      { name: 'Unlimited reporting periods', included: true },
      { name: 'Full calculation engine', included: true },
      { name: 'Priority + phone support', included: true },
      { name: 'Mobile app for field teams', included: true },
      { name: 'Supplier portal', included: true },
      { name: 'Accounting software integration', included: true },
      { name: 'Live dashboard', included: true },
      { name: 'Enterprise security features', included: true },
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
            Start free. Scale with your organization. No hidden fees.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
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
              a: 'Yes. Upgrade, downgrade, or cancel anytime. No long-term contracts required.',
            },
            {
              q: 'Do you offer annual discounts?',
              a: 'Yes. Growth tier is 20% off when paid annually. Contact sales for Enterprise discounts.',
            },
            {
              q: 'Is there a free trial for Growth tier?',
              a: 'Yes. 14-day free trial with all Growth features. No credit card required.',
            },
            {
              q: 'Who owns my data?',
              a: 'You do. We never sell or share data. Full export available anytime.',
            },
            {
              q: 'What calculation engines are included?',
              a: 'All tiers include Scope 1, 2, and basic Scope 3. Growth+ includes ML-based Scope 3 estimation and supplier collaboration.',
            },
            {
              q: 'Can I use Starter tier for production?',
              a: 'Yes, but limited to 100 records. For production use with 100+ records, Growth tier recommended.',
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
              Start free today. No credit card required.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/signup"
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact-sales"
                className="rounded-lg border border-zinc-300 px-6 py-3 font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Schedule Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
