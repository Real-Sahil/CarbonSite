'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flame, Zap, TreesIcon } from 'lucide-react';

export function ScopeComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedScope, setSelectedScope] = useState<string>('scope1');

  useEffect(() => {
    if (!containerRef.current) return;

    const cards = containerRef.current.querySelectorAll('.scope-card');
    cards.forEach((card, i) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: i * 0.1,
          ease: 'power2.out',
        }
      );
    });

    const sourceItems = containerRef.current.querySelectorAll('.source-item');
    sourceItems.forEach((item, i) => {
      gsap.fromTo(
        item,
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          delay: 0.6 + i * 0.05,
          ease: 'power2.out',
        }
      );
    });
  }, [selectedScope]);

  const scopes = [
    {
      id: 'scope1',
      name: 'Scope 1',
      title: 'Direct Emissions',
      color: '#ff6b4c',
      gradient: 'from-red-500 to-rose-600',
      icon: Flame,
      description: 'Emissions from sources owned or controlled by the organization.',
      sources: [
        'Fuel combustion in company vehicles',
        'Natural gas for heating and cooking',
        'Fugitive emissions from refrigerants',
        'Company-owned fleet emissions',
        'On-site power generation',
      ],
      percentage: 45,
      totalEmissions: '2,450 tCO₂e',
      methodology: 'Direct measurement or calculation based on fuel consumption and emission factors.',
    },
    {
      id: 'scope2',
      name: 'Scope 2',
      title: 'Purchased Electricity',
      color: '#f97316',
      gradient: 'from-blue-500 to-cyan-600',
      icon: Zap,
      description: 'Emissions from purchased electricity, steam, heating, and cooling.',
      sources: [
        'Grid electricity purchased',
        'Purchased steam',
        'Purchased heating',
        'Purchased cooling',
        'On-site renewable energy offsets',
      ],
      percentage: 34,
      totalEmissions: '1,820 tCO₂e',
      methodology: 'Location-based (grid average) or market-based (specific contracts and RECs).',
    },
    {
      id: 'scope3',
      name: 'Scope 3',
      title: 'Upstream & Downstream',
      color: '#f4a261',
      gradient: 'from-emerald-500 to-green-600',
      icon: TreesIcon,
      description: 'All other indirect emissions from the value chain.',
      sources: [
        'Business travel (flights, hotels)',
        'Employee commuting',
        'Purchased goods and services',
        'Waste disposal and treatment',
        'Transportation and logistics (haulage)',
      ],
      percentage: 21,
      totalEmissions: '1,050 tCO₂e',
      methodology: 'Spending-based or activity-based calculations using industry average factors.',
    },
  ];

  const selected = scopes.find((s) => s.id === selectedScope)!;
  const SelectedIcon = selected.icon;

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Understanding Scope 1, 2, and 3</h2>
        <p className="text-[#64748B]">GHG Protocol defines three categories of emissions. CarbonSite tracks all of them.</p>
      </div>

      {/* Scope Selector Tabs */}
      <div className="flex gap-4 mb-8 flex-wrap">
        {scopes.map((scope) => {
          const isSelected = selectedScope === scope.id;
          return (
            <button
              key={scope.id}
              onClick={() => setSelectedScope(scope.id)}
              className={`scope-card px-6 py-3 rounded-lg font-semibold transition-all transform ${
                isSelected
                  ? 'shadow-lg scale-105 ring-2 ring-offset-2'
                  : 'hover:shadow-md'
              }`}
              style={{
                backgroundColor: isSelected ? scope.color : `${scope.color}15`,
                color: isSelected ? 'white' : scope.color,
              }}
            >
              {scope.name}
            </button>
          );
        })}
      </div>

      {/* Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Left: Description & Metrics */}
        <div className="scope-card">
          <div
            className={`rounded-2xl p-8 bg-gradient-to-br ${selected.gradient} text-white`}
          >
            {/* Icon & Title */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
                <SelectedIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white/80">{selected.name}</div>
                <h3 className="text-2xl font-bold">{selected.title}</h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-white/90 mb-8 leading-relaxed">{selected.description}</p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-xs text-white/70 mb-1">Percentage of Total</div>
                <div className="text-3xl font-bold">{selected.percentage}%</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-xs text-white/70 mb-1">Total Emissions</div>
                <div className="text-2xl font-bold">{selected.totalEmissions}</div>
              </div>
            </div>

            {/* Methodology Note */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-xs text-white/70">
                <strong className="text-white">Methodology:</strong> {selected.methodology}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Sources List */}
        <div className="scope-card">
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur border border-white/20">
            <h4 className="text-lg font-bold text-[#0F172A] mb-6">Common Sources</h4>

            <div className="space-y-3">
              {selected.sources.map((source, i) => (
                <div
                  key={i}
                  className="source-item flex items-start gap-3 p-3 rounded-lg hover:bg-white/40 transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: selected.color }}
                  />
                  <p className="text-[#0F172A] text-sm leading-relaxed">{source}</p>
                </div>
              ))}
            </div>

            {/* GHG Protocol Note */}
            <div className="mt-8 p-4 rounded-lg bg-gray-100 border border-gray-200">
              <p className="text-xs text-[#0F172A]">
                <strong>GHG Protocol Corporate Standard v2026-01</strong> is the international standard for measuring and reporting corporate greenhouse gas emissions. CarbonSite implements all three scopes with full audit trail and immutable recording.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A]">Aspect</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A]">Scope 1</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A]">Scope 2</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A]">Scope 3</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  aspect: 'Ownership',
                  scope1: 'Owned/Controlled',
                  scope2: 'Purchased',
                  scope3: 'Value Chain',
                },
                {
                  aspect: 'Data Source',
                  scope1: 'Fuel invoices, meters',
                  scope2: 'Utility bills',
                  scope3: 'Receipts, estimates',
                },
                {
                  aspect: 'Mandatory',
                  scope1: '✓ Always',
                  scope2: '✓ Always',
                  scope3: '✓ Major sources',
                },
                {
                  aspect: 'Measurement',
                  scope1: 'Direct',
                  scope2: 'Grid/Market',
                  scope3: 'Spending/Activity',
                },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-[#0F172A]">{row.aspect}</td>
                  <td className="px-6 py-4 text-sm text-[#64748B]">{row.scope1}</td>
                  <td className="px-6 py-4 text-sm text-[#64748B]">{row.scope2}</td>
                  <td className="px-6 py-4 text-sm text-[#64748B]">{row.scope3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
