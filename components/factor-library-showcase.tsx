'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CheckCircle2, Database, Globe, Zap } from 'lucide-react';

interface FactorSource {
  name: string;
  region: string;
  factors: number;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  coverage: number;
}

export function FactorLibraryShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<string>('defra');

  const libraries: Record<string, FactorSource> = {
    defra: {
      name: 'DEFRA 2025.1',
      region: 'United Kingdom',
      factors: 2400,
      description: 'UK government conversion factors for GHG emissions. Covers waste, transport, energy, and industrial activities.',
      icon: <Globe className="h-6 w-6" />,
      gradient: 'from-blue-500 to-cyan-600',
      coverage: 92,
    },
    epa: {
      name: 'EPA GHG Hub 2025',
      region: 'United States',
      factors: 1800,
      description: 'EPA emission factors for US-based calculations. Includes regional electricity grid mixes and scope 2 methods.',
      icon: <Zap className="h-6 w-6" />,
      gradient: 'from-amber-500 to-orange-600',
      coverage: 88,
    },
    sustainmetrics: {
      name: 'SustainMetrics Global',
      region: 'International',
      factors: 3200,
      description: 'Comprehensive global emission factors. Multi-country support with consistent methodology across regions.',
      icon: <Database className="h-6 w-6" />,
      gradient: 'from-emerald-500 to-green-600',
      coverage: 95,
    },
  };

  const selectedLib = libraries[selectedLibrary];

  useEffect(() => {
    if (!containerRef.current) return;

    const cards = containerRef.current.querySelectorAll('.library-card');
    cards.forEach((card, i) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: i * 0.1,
          ease: 'power2.out',
        }
      );
    });

    const counterElements = containerRef.current.querySelectorAll('.factor-counter');
    counterElements.forEach((counter) => {
      const target = parseInt(counter.getAttribute('data-target') || '0');
      gsap.fromTo(
        counter,
        { textContent: '0' },
        {
          textContent: target,
          duration: 1.5,
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

    const coverageBars = containerRef.current.querySelectorAll('.coverage-bar-fill');
    coverageBars.forEach((bar) => {
      const target = parseInt(bar.getAttribute('data-coverage') || '0');
      gsap.fromTo(
        bar,
        { width: '0%' },
        {
          width: `${target}%`,
          duration: 1.2,
          delay: 0.3,
          ease: 'power2.out',
        }
      );
    });
  }, [selectedLibrary]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Factor Library Coverage</h2>
        <p className="text-[#64748B]">Global emission factors from authoritative sources. Always traceable, never outdated.</p>
      </div>

      {/* Library Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Object.entries(libraries).map(([key, lib]) => (
          <button
            key={key}
            onClick={() => setSelectedLibrary(key)}
            className={`library-card relative rounded-2xl p-8 text-left transition-all transform ${
              selectedLibrary === key
                ? 'ring-2 ring-offset-2 ring-[#ffdc6e] shadow-xl scale-105'
                : 'hover:shadow-lg'
            }`}
            style={{
              background:
                selectedLibrary === key
                  ? `linear-gradient(135deg, ${selectedLibrary === 'defra' ? '#0EA5E9' : selectedLibrary === 'epa' ? '#F97316' : '#10B981'}15 0%, ${selectedLibrary === 'defra' ? '#0EA5E9' : selectedLibrary === 'epa' ? '#F97316' : '#10B981'}05 100%)`
                  : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            {/* Icon */}
            <div
              className={`w-12 h-12 rounded-lg bg-gradient-to-br ${lib.gradient} text-white flex items-center justify-center mb-4`}
            >
              {lib.icon}
            </div>

            {/* Title */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-[#0F172A] mb-1">{lib.name}</h3>
              <p className="text-sm text-[#64748B]">{lib.region}</p>
            </div>

            {/* Factor Count */}
            <div className="mb-4">
              <div className="text-2xl font-bold">
                <span className="factor-counter" data-target={lib.factors}>
                  0
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">Emission factors</p>
            </div>

            {/* Checkmark for active */}
            {selectedLibrary === key && (
              <div className="absolute top-4 right-4 text-[#ffdc6e]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Detailed View */}
      <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur rounded-2xl p-8 border border-white/20">
        {/* Library Description */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedLib.gradient} text-white flex items-center justify-center`}>
              {selectedLib.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#0F172A] mb-2">{selectedLib.name}</h3>
              <p className="text-[#64748B] leading-relaxed">{selectedLib.description}</p>
            </div>
          </div>
        </div>

        {/* Coverage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Regional Coverage */}
          <div>
            <h4 className="text-sm font-semibold text-[#0F172A] mb-4">Global Coverage</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-[#0F172A]">{selectedLib.name}</span>
                  <span className="text-xs text-[#64748B]">{selectedLib.coverage}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="coverage-bar-fill h-full bg-gradient-to-r from-[#ffdc6e] to-[#ff0027] rounded-full"
                    data-coverage={selectedLib.coverage}
                    style={{ width: '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div>
            <h4 className="text-sm font-semibold text-[#0F172A] mb-4">Key Features</h4>
            <ul className="space-y-2">
              {[
                'AR6 GWP values included',
                'Scope 1, 2, 3 coverage',
                'Regularly updated',
                'Audit-ready data',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-[#64748B]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffdc6e]" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Methodology Note */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-xs text-[#64748B] leading-relaxed">
            <strong className="text-[#0F172A]">Methodology:</strong> All factors calculated using GHG Protocol Corporate Standard v2026-01. Immutable factor versions stored per calculation run for audit compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
