'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { TrendingUp } from 'lucide-react';

interface ScopeData {
  scope: string;
  label: string;
  co2e: number;
  percentage: number;
  color: string;
  gradient: string;
  examples: string[];
}

export function EmissionsBreakdownCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeScope, setActiveScope] = useState<string | null>(null);

  const scopeData: ScopeData[] = [
    {
      scope: 'Scope 1',
      label: 'Direct Emissions',
      co2e: 2450,
      percentage: 45,
      color: '#ff6b4c',
      gradient: 'from-red-500 to-rose-600',
      examples: ['Fuel combustion', 'Mobile sources'],
    },
    {
      scope: 'Scope 2',
      label: 'Purchased Electricity',
      co2e: 1820,
      percentage: 34,
      color: '#f97316',
      gradient: 'from-blue-500 to-cyan-600',
      examples: ['Grid electricity', 'Steam/heating'],
    },
    {
      scope: 'Scope 3',
      label: 'Upstream & Downstream',
      co2e: 1050,
      percentage: 21,
      color: '#f4a261',
      gradient: 'from-emerald-500 to-green-600',
      examples: ['Business travel', 'Waste disposal', 'Haulage'],
    },
  ];

  const totalCo2e = scopeData.reduce((sum, item) => sum + item.co2e, 0);

  useEffect(() => {
    if (!containerRef.current) return;

    const bars = containerRef.current.querySelectorAll('.scope-bar-fill');
    bars.forEach((bar, i) => {
      gsap.fromTo(
        bar,
        { width: '0%' },
        {
          width: `${scopeData[i].percentage}%`,
          duration: 1.2,
          delay: i * 0.15,
          ease: 'power2.out',
        }
      );
    });

    const counters = containerRef.current.querySelectorAll('.co2e-counter');
    counters.forEach((counter, i) => {
      const target = scopeData[i].co2e;
      gsap.fromTo(
        counter,
        { textContent: '0' },
        {
          textContent: target,
          duration: 1.5,
          delay: i * 0.15,
          ease: 'power2.out',
          snap: { textContent: 1 },
          onUpdate() {
            if (counter instanceof HTMLElement) {
              counter.textContent = Math.floor(Number(gsap.getProperty(counter, 'textContent'))).toLocaleString();
            }
          },
        }
      );
    });
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-[#0F172A] mb-1">Emissions Breakdown</h3>
            <p className="text-sm text-[#64748B]">Period: January 2026</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold bg-gradient-to-r from-[#ffdc6e] to-[#ff0027] bg-clip-text text-transparent">
              {totalCo2e.toLocaleString()}
            </div>
            <p className="text-xs text-[#64748B] mt-1">tCO₂e Total</p>
          </div>
        </div>
      </div>

      {/* Scope Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {scopeData.map((item, i) => (
          <button
            key={item.scope}
            onClick={() => setActiveScope(activeScope === item.scope ? null : item.scope)}
            className={`relative rounded-xl p-6 text-left transition-all transform hover:scale-105 cursor-pointer ${
              activeScope === item.scope
                ? 'ring-2 ring-offset-2 ring-[#ffdc6e] shadow-lg'
                : 'hover:shadow-md'
            }`}
            style={{
              background:
                activeScope === item.scope
                  ? `linear-gradient(135deg, ${item.color}15 0%, ${item.color}05 100%)`
                  : 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${item.color}40`,
            }}
          >
            {/* Scope Label */}
            <div className="mb-4">
              <div className="text-xs font-semibold mb-1" style={{ color: item.color }}>
                {item.scope}
              </div>
              <div className="text-base font-semibold text-[#0F172A]">{item.label}</div>
            </div>

            {/* Counter with animation */}
            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <div className="co2e-counter text-2xl font-bold text-[#0F172A]">0</div>
                <div className="text-xs text-[#64748B]">tCO₂e</div>
              </div>
            </div>

            {/* Percentage Bar */}
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="scope-bar-fill h-full rounded-full transition-all"
                style={{ backgroundColor: item.color, width: '0%' }}
              />
            </div>
            <div className="text-xs text-[#64748B]">{item.percentage}% of total</div>

            {/* Examples on hover/active */}
            {activeScope === item.scope && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: `${item.color}30` }}>
                <div className="text-xs font-semibold text-[#0F172A] mb-2">Examples:</div>
                <ul className="text-xs text-[#64748B] space-y-1">
                  {item.examples.map((example) => (
                    <li key={example} className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Stacked Bar Chart */}
      <div className="bg-white/40 backdrop-blur rounded-xl p-6 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[#ffdc6e]" />
          <h4 className="text-sm font-semibold text-[#0F172A]">Scope Distribution</h4>
        </div>

        <div className="flex h-8 rounded-lg overflow-hidden shadow-md">
          {scopeData.map((item) => (
            <div
              key={item.scope}
              className="flex-1 transition-all hover:opacity-80 cursor-pointer relative group"
              style={{
                backgroundColor: item.color,
                width: `${item.percentage}%`,
              }}
              title={`${item.scope}: ${item.percentage}%`}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all" />
              {item.percentage > 15 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.percentage}%
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          {scopeData.map((item) => (
            <div key={item.scope} className="text-center">
              <div className="text-xs font-semibold text-[#0F172A] mb-1">{item.scope}</div>
              <div className="flex items-center justify-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-[#64748B]">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
