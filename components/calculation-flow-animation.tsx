'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, Activity, Calculator, FileCheck, BarChart3 } from 'lucide-react';

export function CalculationFlowAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const timeline = gsap.timeline();

    // Animate step containers
    const steps = containerRef.current.querySelectorAll('.calculation-step');
    steps.forEach((step, i) => {
      timeline.fromTo(
        step,
        { opacity: 0, y: 30, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: 'back.out',
        },
        i * 0.2
      );
    });

    // Animate connector arrows
    const arrows = containerRef.current.querySelectorAll('.flow-arrow');
    arrows.forEach((arrow, i) => {
      timeline.fromTo(
        arrow,
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1,
          opacity: 1,
          duration: 0.4,
          ease: 'power1.inOut',
        },
        i * 0.2 + 0.3
      );
    });

    // Animate input data cards within steps
    const dataCards = containerRef.current.querySelectorAll('.data-card');
    dataCards.forEach((card, i) => {
      timeline.fromTo(
        card,
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
        },
        `<${i * 0.1}`
      );
    });

    // Animate result highlights
    const resultHighlights = containerRef.current.querySelectorAll('.result-highlight');
    resultHighlights.forEach((highlight, i) => {
      timeline.fromTo(
        highlight,
        { backgroundPosition: '200% center' },
        {
          backgroundPosition: '0% center',
          duration: 2,
          ease: 'none',
          repeat: -1,
        },
        '<'
      );
    });

    timeline.eventCallback('onComplete', () => setAnimationComplete(true));

    return () => {
      timeline.kill();
    };
  }, []);

  const steps = [
    {
      title: 'Raw Activity Data',
      description: 'Mobile OCR or CSV import',
      icon: Activity,
      inputs: ['Weight: 500 kg', 'Date: 15 Jan 2026', 'Type: Waste'],
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'from-blue-50 to-cyan-50',
    },
    {
      title: 'Factor Selection',
      description: 'Match geography & category',
      icon: Calculator,
      inputs: ['Library: DEFRA 2025.1', 'Scope: 1 (Direct)', 'Region: UK'],
      color: 'from-amber-500 to-orange-600',
      bgColor: 'from-amber-50 to-orange-50',
    },
    {
      title: 'Calculation Engine',
      description: 'Activity × Factor = CO₂e',
      icon: BarChart3,
      inputs: ['500 kg × 0.42 kg CO₂/kg', 'GWP AR6: CH₄ 27.9', 'Result: 210 kg CO₂e'],
      color: 'from-red-500 to-rose-600',
      bgColor: 'from-red-50 to-rose-50',
    },
    {
      title: 'Immutable Result',
      description: 'Published & auditable',
      icon: FileCheck,
      inputs: ['Snapshot v1.2', 'SHA-256: abc123...', 'Audit Ready ✓'],
      color: 'from-emerald-500 to-green-600',
      bgColor: 'from-emerald-50 to-green-50',
    },
  ];

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Calculation Pipeline</h2>
        <p className="text-[#64748B]">From raw activity data to audit-ready emission results in four steps.</p>
      </div>

      {/* Flow Container */}
      <div className="relative">
        {/* Desktop Flow (horizontal) */}
        <div className="hidden md:flex items-stretch gap-4 relative">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div key={i} className="flex-1 flex flex-col relative">
                {/* Step Card */}
                <div className="calculation-step flex-1">
                  <div
                    className={`h-full rounded-2xl p-6 bg-gradient-to-br ${step.bgColor} border border-gray-200 flex flex-col`}
                  >
                    {/* Icon & Title */}
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${step.color} text-white flex items-center justify-center mb-4`}>
                      <StepIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0F172A] mb-1">{step.title}</h3>
                    <p className="text-sm text-[#64748B] mb-6">{step.description}</p>

                    {/* Data Cards */}
                    <div className="space-y-2">
                      {step.inputs.map((input, j) => (
                        <div key={j} className="data-card">
                          <div className="bg-white/60 backdrop-blur rounded-lg px-3 py-2 border border-white/40">
                            <p className="text-xs text-[#0F172A] font-mono">{input}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Arrow Connector */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-6 top-1/2 -translate-y-1/2 z-10">
                    <div className="flow-arrow w-12 h-1 bg-gradient-to-r from-[#ffdc6e] to-[#ff0027] rounded-full origin-left" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Flow (vertical) */}
        <div className="md:hidden space-y-4">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div key={i} className="flex gap-4">
                {/* Step Card */}
                <div className="calculation-step flex-1">
                  <div
                    className={`rounded-2xl p-6 bg-gradient-to-br ${step.bgColor} border border-gray-200`}
                  >
                    {/* Icon & Title */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.color} text-white flex items-center justify-center flex-shrink-0`}>
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#0F172A]">{step.title}</h3>
                        <p className="text-xs text-[#64748B]">{step.description}</p>
                      </div>
                    </div>

                    {/* Data Cards */}
                    <div className="space-y-2">
                      {step.inputs.map((input, j) => (
                        <div key={j} className="data-card">
                          <div className="bg-white/60 backdrop-blur rounded-lg px-3 py-2 border border-white/40">
                            <p className="text-xs text-[#0F172A] font-mono">{input}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Arrow Down */}
                {i < steps.length - 1 && (
                  <div className="flex justify-center w-6">
                    <div className="flow-arrow w-1 h-12 bg-gradient-to-b from-[#ffdc6e] to-[#ff0027] rounded-full origin-top" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Results Summary */}
      {animationComplete && (
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-[#ffdc6e]/10 to-[#ff0027]/10 border border-[#ffdc6e]/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#ffdc6e] to-[#ff0027] text-white flex items-center justify-center">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">Every Step Immutable</h3>
              <p className="text-sm text-[#64748B]">Results cannot be changed once published. Audit trail captures every factor version and formula used.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Factor Version', value: 'DEFRA 2025.1' },
              { label: 'Methodology', value: 'GHG Protocol v2026-01' },
              { label: 'Audit Status', value: 'Ready ✓' },
            ].map((item) => (
              <div key={item.label} className="result-highlight p-4 rounded-lg bg-gradient-to-r from-white/50 to-white/20 border border-white/30">
                <p className="text-xs text-[#64748B] mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-[#0F172A]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
