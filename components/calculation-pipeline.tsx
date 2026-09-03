'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Database, Zap, TrendingUp, Shield } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

type PathwayType = 'scope1' | 'scope2' | 'scope3' | null;

export function CalculationPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePathway, setActivePathway] = useState<PathwayType>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll('.pipeline-item');
    items.forEach((item, i) => {
      gsap.fromTo(
        item,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: i * 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50 py-24 px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="pipeline-item text-center mb-20">
          <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 mb-6">
            Calculation Engine
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From activity records to immutable emission calculations. Every step traced, auditable, and transparent.
          </p>
        </div>

        {/* Main Pipeline */}
        <div className="space-y-8">
          {/* Stage 1: Input */}
          <div className="pipeline-item">
            <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Stage 1: Data Collection</h3>
              </div>
              <p className="text-gray-600 mb-6">Activity records enter from multiple channels</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['Waste Ticket', 'Delivery Note', 'Fuel Receipt', 'Mobile Capture'].map((source) => (
                  <div
                    key={source}
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="font-semibold text-blue-900">{source}</div>
                    <div className="text-xs text-gray-500 mt-1">OCR Extracted</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="animate-bounce">
              <ArrowRight className="h-8 w-8 text-cyan-500 rotate-90" />
            </div>
          </div>

          {/* Stage 2: Factor Selection */}
          <div className="pipeline-item">
            <div className="bg-white rounded-2xl border-2 border-cyan-200 p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl text-white">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Stage 2: Factor Selection</h3>
              </div>
              <p className="text-gray-600 mb-6">Emission factors matched by geography, activity type, and methodology</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'DEFRA 2025.1', region: 'UK', factors: '2,400+' },
                  { name: 'EPA GHG Hub 2025', region: 'US', factors: '1,800+' },
                  { name: 'SustainMetrics', region: 'Global', factors: '3,200+' },
                ].map((db) => (
                  <div
                    key={db.name}
                    className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="font-semibold text-blue-900">{db.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{db.region}</div>
                    <div className="text-xs text-cyan-600 font-semibold mt-2">{db.factors} factors</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="animate-bounce">
              <ArrowRight className="h-8 w-8 text-cyan-500 rotate-90" />
            </div>
          </div>

          {/* Stage 3: Calculation Engine */}
          <div className="pipeline-item">
            <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-600 rounded-2xl p-8 shadow-2xl text-white">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-3xl font-bold">Calculation Engine</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Formula */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                  <div className="text-sm font-semibold mb-3 text-blue-100">Core Formula</div>
                  <div className="text-3xl font-mono font-bold mb-2">Activity × Factor</div>
                  <div className="text-2xl font-mono">=</div>
                  <div className="text-3xl font-mono font-bold mt-2 text-cyan-200">CO₂e</div>
                </div>

                {/* GWP Values */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                  <div className="text-sm font-semibold mb-3 text-blue-100">AR6 GWP Values</div>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span>CO₂</span>
                      <span className="text-cyan-200">1</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CH₄</span>
                      <span className="text-cyan-200">27.9</span>
                    </div>
                    <div className="flex justify-between">
                      <span>N₂O</span>
                      <span className="text-cyan-200">273</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20 text-sm">
                <div className="text-blue-100">Methodology: GHG Protocol Corporate Standard v2026-01</div>
                <div className="text-blue-100 mt-1">Factor Library: DEFRA 2025.1 + EPA 2025.1 + SustainMetrics</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="animate-bounce">
              <ArrowRight className="h-8 w-8 text-cyan-500 rotate-90" />
            </div>
          </div>

          {/* Stage 4: Results & Scope Breakdown */}
          <div className="pipeline-item">
            <div className="bg-white rounded-2xl border-2 border-emerald-200 p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-900">Stage 4: Results & Scope Breakdown</h3>
              </div>
              <p className="text-gray-600 mb-6">Emissions split into Scope 1, 2, and 3 categories</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    scope: 'Scope 1',
                    label: 'Direct Emissions',
                    color: 'from-red-500 to-rose-600',
                    examples: 'Fuel combustion, Mobile sources',
                  },
                  {
                    scope: 'Scope 2',
                    label: 'Purchased Electricity',
                    color: 'from-blue-500 to-cyan-600',
                    examples: 'Grid electricity, Steam/heating',
                  },
                  {
                    scope: 'Scope 3',
                    label: 'Upstream & Downstream',
                    color: 'from-emerald-500 to-green-600',
                    examples: 'Business travel, Waste disposal, Haulage',
                  },
                ].map((item) => (
                  <button
                    key={item.scope}
                    onClick={() => { const key = item.scope.split(' ')[1].toLowerCase() as PathwayType; setActivePathway(activePathway === key ? null : key); }}
                    className={`rounded-xl p-6 text-left transition-all cursor-pointer transform hover:scale-105 ${
                      activePathway === item.scope.split(' ')[1].toLowerCase()
                        ? 'ring-2 ring-offset-2 ring-gray-400'
                        : ''
                    }`}
                  >
                    <div className={`bg-gradient-to-br ${item.color} rounded-lg p-4 text-white mb-4`}>
                      <div className="text-sm font-semibold text-white/80">{item.scope}</div>
                      <div className="text-2xl font-bold">{item.label}</div>
                    </div>
                    <div className="text-sm text-gray-600">{item.examples}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="animate-bounce">
              <ArrowRight className="h-8 w-8 text-cyan-500 rotate-90" />
            </div>
          </div>

          {/* Stage 5: Audit Trail & Publication */}
          <div className="pipeline-item">
            <div className="bg-white rounded-2xl border-2 border-purple-200 p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-purple-900">Stage 5: Immutable Publication</h3>
              </div>
              <p className="text-gray-600 mb-6">Results locked in versioned snapshots with complete audit trail</p>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <div className="font-semibold text-purple-900">Calculation Run</div>
                    <div className="text-sm text-gray-600">Complete emission calculation stored with factor versions</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <div className="font-semibold text-purple-900">Published Snapshot</div>
                    <div className="text-sm text-gray-600">Immutable version v1.0 linking period to calculation run</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <div className="font-semibold text-purple-900">Audit Trail</div>
                    <div className="text-sm text-gray-600">Append-only log: every action, factor used, formula applied, timestamp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pipeline-item text-center mt-12">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-12 text-white shadow-xl">
              <h3 className="text-3xl font-bold mb-4">Ready to track with confidence?</h3>
              <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
                Every emission is traceable. Every calculation is verifiable. Every figure is audit-ready.
              </p>
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-colors">
                Start Your Calculation
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
