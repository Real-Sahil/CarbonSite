'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Calculator } from 'lucide-react';

interface PricingTier {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  cta: string;
  features: {
    name: string;
    included: boolean;
  }[];
  highlighted?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'For startups and pilots',
    cta: 'Start for Free',
    features: [
      { name: 'Up to 100 activity records/month', included: true },
      { name: '1 facility', included: true },
      { name: 'Community support (email)', included: true },
      { name: 'Basic dashboard', included: true },
      { name: 'PDF reports', included: true },
      { name: 'Unlimited access (no time limit)', included: true },
      { name: 'Scope 3 estimation', included: false },
      { name: 'Anomaly detection', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'SSO/SAML', included: false },
    ],
  },
  {
    name: 'Growth',
    monthlyPrice: 50,
    yearlyPrice: 500,
    description: 'For mid-market companies',
    cta: 'Start Growth',
    highlighted: true,
    features: [
      { name: 'Up to 10,000 activity records/month', included: true },
      { name: 'Unlimited facilities', included: true },
      { name: 'Email support (24-48h response)', included: true },
      { name: 'Advanced dashboard + drill-down', included: true },
      { name: 'PDF & CSV exports', included: true },
      { name: 'Unlimited access', included: true },
      { name: 'Scope 3 ML estimation', included: true },
      { name: 'Anomaly detection with flagging', included: true },
      { name: 'Supplier portal + field workers', included: true },
      { name: 'API access (basic)', included: true },
      { name: 'SSO/SAML', included: false },
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'For large organizations',
    cta: 'Contact Sales',
    features: [
      { name: 'Unlimited activity records', included: true },
      { name: 'Unlimited facilities + multi-org', included: true },
      { name: 'Priority support (2-hour SLA)', included: true },
      { name: 'Real-time dashboards (SSE)', included: true },
      { name: 'Full data export + streaming', included: true },
      { name: 'Unlimited access', included: true },
      { name: 'Advanced Scope 3 modeling', included: true },
      { name: 'Custom anomaly detection rules', included: true },
      { name: 'Dedicated supplier portal', included: true },
      { name: 'Full REST & GraphQL API', included: true },
      { name: 'SSO/SAML + 2FA', included: true },
    ],
  },
];

interface ROIInput {
  currentCost: number;
  hoursPerMonth: number;
  laborCostPerHour: number;
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [roiInputs, setRoiInputs] = useState<ROIInput>({
    currentCost: 5000,
    hoursPerMonth: 40,
    laborCostPerHour: 75,
  });

  const monthlyLaborCost = roiInputs.hoursPerMonth * roiInputs.laborCostPerHour * 12;
  const totalCurrentCost = roiInputs.currentCost * 12 + monthlyLaborCost;
  const carbonSiteCost = 500; // Growth tier yearly
  const savings = totalCurrentCost - carbonSiteCost;
  const paybackMonths = carbonSiteCost / (savings / 12);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            No hidden fees. No "contact sales" required to see the cost. Pay for what you use.
          </p>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-sm font-medium ${
                billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-600'
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-200"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-600'
              }`}
            >
              Yearly (Save 17%)
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-lg overflow-hidden transition-all ${
                tier.highlighted
                  ? 'ring-2 ring-blue-600 shadow-xl transform scale-105'
                  : 'bg-white shadow-lg hover:shadow-xl'
              } ${!tier.highlighted ? 'bg-white' : 'bg-gradient-to-br from-blue-50 to-white'}`}
            >
              {/* Card Header */}
              <div className={`p-8 ${tier.highlighted ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-white border-b border-gray-200'}`}>
                <h3
                  className={`text-2xl font-bold mb-2 ${
                    tier.highlighted ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {tier.name}
                </h3>
                <p
                  className={`text-sm ${
                    tier.highlighted ? 'text-blue-100' : 'text-gray-600'
                  }`}
                >
                  {tier.description}
                </p>
                <div className="mt-6">
                  {tier.monthlyPrice === 0 && tier.yearlyPrice === 0 ? (
                    <div className={`text-3xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                      Custom
                    </div>
                  ) : (
                    <>
                      <div className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                        ${billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice}
                      </div>
                      <div className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        per {billingCycle === 'monthly' ? 'month' : 'year'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* CTA Button */}
              <div className="p-6 border-b border-gray-200">
                <Link
                  href={tier.name === 'Free' ? '/start' : tier.name === 'Growth' ? '/start' : '/contact'}
                  className={`block w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>

              {/* Features List */}
              <div className="p-8">
                <ul className="space-y-4">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 rounded border border-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included ? 'text-gray-900' : 'text-gray-500 line-through'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROI Calculator */}
      <div className="bg-blue-50 border-y border-blue-200 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <Calculator className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">ROI Calculator</h2>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-lg">
            <p className="text-gray-600 mb-8">
              See how much CarbonSite saves by automating carbon data collection.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {/* Input 1: Current Annual Cost */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Current annual cost (other platforms)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    value={roiInputs.currentCost}
                    onChange={(e) =>
                      setRoiInputs({
                        ...roiInputs,
                        currentCost: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">/year</span>
                </div>
              </div>

              {/* Input 2: Hours Per Month */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Hours spent on data collection/review
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={roiInputs.hoursPerMonth}
                    onChange={(e) =>
                      setRoiInputs({
                        ...roiInputs,
                        hoursPerMonth: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">hrs/month</span>
                </div>
              </div>

              {/* Input 3: Labor Cost */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Labor cost per hour
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    value={roiInputs.laborCostPerHour}
                    onChange={(e) =>
                      setRoiInputs({
                        ...roiInputs,
                        laborCostPerHour: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">/hr</span>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid md:grid-cols-4 gap-6 pt-8 border-t border-gray-200">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-2">Current annual cost</div>
                <div className="text-3xl font-bold text-gray-900">
                  ${(totalCurrentCost / 1000).toFixed(1)}k
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-2">CarbonSite cost</div>
                <div className="text-3xl font-bold text-gray-900">
                  ${(carbonSiteCost / 1000).toFixed(1)}k
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                <div className="text-sm text-green-700 font-semibold mb-2">Annual savings</div>
                <div className="text-3xl font-bold text-green-600">
                  ${(savings / 1000).toFixed(1)}k
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                <div className="text-sm text-blue-700 font-semibold mb-2">Payback period</div>
                <div className="text-3xl font-bold text-blue-600">
                  {paybackMonths < 1 ? '<1' : paybackMonths.toFixed(0)} month{paybackMonths !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              *Based on Growth tier ($500/year). Enterprise tier pricing and savings will vary. ROI
              assumes 20% time savings on data collection and review.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">Frequently Asked Questions</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I upgrade mid-month?</h3>
            <p className="text-gray-600">
              Yes. You can upgrade or downgrade at any time. We'll prorate charges for the remainder of your billing cycle.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What if I exceed my plan limits?</h3>
            <p className="text-gray-600">
              You'll be notified when you're approaching your limits. You can upgrade immediately or we can discuss a custom tier. We never shut off access mid-month.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Is there a contract?</h3>
            <p className="text-gray-600">
              Free and Growth tiers are month-to-month. Enterprise customers can choose annual contracts with discounts.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Do you offer discounts for non-profits?</h3>
            <p className="text-gray-600">
              Yes. Non-profits get 50% off Growth tier. Contact us with your 501(c)(3) letter.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
            <p className="text-gray-600">
              We accept credit cards (Visa, Mastercard, Amex) and invoicing for Enterprise customers. 30-day net terms available.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
            <p className="text-gray-600">
              Yes. Month-to-month plans can be cancelled any time with 7 days notice. No penalties, no questions asked.
            </p>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start tracking emissions today</h2>
          <p className="text-blue-100 text-lg mb-8">
            Free tier includes everything you need to get started. No credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/start"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
