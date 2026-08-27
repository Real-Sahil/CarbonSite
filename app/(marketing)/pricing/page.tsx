import Link from "next/link";
import { Metadata } from "next";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing | CarbonSite",
  description: "Transparent pricing for carbon accounting. Start free, scale as you grow. No hidden fees.",
  openGraph: {
    title: "Pricing | CarbonSite",
    description: "Transparent pricing for carbon accounting. Start free, scale as you grow.",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAFBF8] text-[#111827] py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-4">Transparent Pricing</h1>
          <p className="text-xl text-gray-600">
            Start free. Scale as you grow. No hidden fees, no surprise bills.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Starter Tier */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-2xl font-bold mb-2">Starter</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <p className="text-gray-600 mb-8">Perfect for trying CarbonSite</p>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Up to 100 activity records</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>1 facility</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Basic CSV import</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Community support</span>
              </li>
              <li className="flex items-center gap-3 text-gray-400">
                <span className="w-5 h-5">—</span>
                <span>Field submissions</span>
              </li>
              <li className="flex items-center gap-3 text-gray-400">
                <span className="w-5 h-5">—</span>
                <span>Advanced reports</span>
              </li>
            </ul>

            <button className="w-full px-6 py-3 bg-gray-100 text-gray-900 rounded font-medium hover:bg-gray-200 transition-colors">
              Get Started
            </button>
          </div>

          {/* Growth Tier */}
          <div className="bg-white rounded-lg border-2 border-blue-600 p-8 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>

            <h3 className="text-2xl font-bold mb-2">Growth</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">$50</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <p className="text-gray-600 mb-8">For growing teams</p>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Up to 10,000 records</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Unlimited facilities</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>CSV + Excel import</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Field submissions (mobile OCR)</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Scope 3 estimation</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Email support</span>
              </li>
            </ul>

            <button className="w-full px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors">
              Start Free Trial
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <div className="mb-6">
              <span className="text-2xl font-bold">Custom</span>
              <span className="text-gray-600 ml-2">pricing</span>
            </div>
            <p className="text-gray-600 mb-8">For large organizations</p>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Unlimited records</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>SSO/SAML authentication</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Advanced analytics</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>SLA support</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Dedicated support</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span>Custom integrations</span>
              </li>
            </ul>

            <button className="w-full px-6 py-3 border border-blue-600 text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-3">How does billing work?</h3>
              <p className="text-gray-600">
                You're only charged for what you use. Monthly billing based on your usage tier and features.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">Can I upgrade anytime?</h3>
              <p className="text-gray-600">
                Yes. Upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">Is there a free trial?</h3>
              <p className="text-gray-600">
                Starter tier is free forever. Growth plan includes 14-day free trial with no credit card required.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">What about data ownership?</h3>
              <p className="text-gray-600">
                You own your data. We don't sell it. You can export at any time, in any format.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">Do you have annual discounts?</h3>
              <p className="text-gray-600">
                Yes. Annual plans include 20% discount. Contact sales for custom annual pricing.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                Credit card (Visa, Mastercard, Amex), bank transfer, and purchase orders for Enterprise.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-blue-50 rounded-lg border border-blue-100 p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Join teams that trust CarbonSite for audit-ready carbon accounting.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/blog"
              className="px-6 py-3 border border-blue-600 text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
            >
              Read Our Blog
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
