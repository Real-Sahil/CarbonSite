'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { TrendingDown, Target, Zap } from 'lucide-react';

export function CarbonReductionTracker() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const timeline = gsap.timeline();

    // Main progress ring animation
    const progressRings = containerRef.current.querySelectorAll('.progress-ring');
    progressRings.forEach((ring, i) => {
      const circumference = 2 * Math.PI * 45;
      const strokeDashoffset = circumference * (1 - (i === 0 ? 0.42 : i === 1 ? 0.68 : 0.25));

      timeline.fromTo(
        ring,
        { strokeDashoffset: circumference },
        {
          strokeDashoffset: strokeDashoffset,
          duration: 1.5,
          ease: 'power2.out',
        },
        i * 0.15
      );
    });

    // Animate percentage counters
    const percentages = containerRef.current.querySelectorAll('.percentage-counter');
    percentages.forEach((counter, i) => {
      const targets = [42, 68, 25];
      timeline.fromTo(
        counter,
        { textContent: '0%' },
        {
          textContent: `${targets[i]}%`,
          duration: 1.5,
          ease: 'power2.out',
          snap: { textContent: 1 },
          onUpdate() {
            if (counter instanceof HTMLElement) {
              counter.textContent = `${Math.floor(Number(gsap.getProperty(counter, 'textContent')))}%`;
            }
          },
        },
        i * 0.15
      );
    });

    // Animate metric cards
    const cards = containerRef.current.querySelectorAll('.metric-card');
    cards.forEach((card, i) => {
      timeline.fromTo(
        card,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'back.out',
        },
        1.8 + i * 0.1
      );
    });

    return () => {
      timeline.kill();
    };
  }, []);

  const progressData = [
    {
      title: '2025 Target Progress',
      current: 4200,
      target: 10000,
      percentage: 42,
      unit: 'tCO₂e',
      color: '#ff6b4c',
      gradient: 'from-red-500 to-rose-600',
      description: '4.2 of 10.0 tCO₂e target achieved',
    },
    {
      title: '2026 Projection',
      current: 6800,
      target: 10000,
      percentage: 68,
      unit: 'tCO₂e',
      color: '#ffdc6e',
      gradient: 'from-amber-500 to-orange-600',
      description: '6.8 tCO₂e projected at current rate',
    },
    {
      title: 'Scope 2 Reduction',
      current: 2500,
      target: 10000,
      percentage: 25,
      unit: 'tCO₂e',
      color: '#10B981',
      gradient: 'from-emerald-500 to-green-600',
      description: 'Clean energy adoption progress',
    },
  ];

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown className="h-8 w-8 text-[#ff0027]" />
          <h2 className="text-3xl font-bold text-[#0F172A]">Carbon Reduction Goals</h2>
        </div>
        <p className="text-[#64748B]">Track progress toward your net-zero commitment with real-time metrics.</p>
      </div>

      {/* Progress Rings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {progressData.map((data, i) => (
          <div key={i} className="flex flex-col items-center">
            {/* Circular Progress */}
            <div className="relative w-32 h-32 mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={data.color}
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45}
                  strokeLinecap="round"
                  className="progress-ring transition-all"
                />
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="percentage-counter text-2xl font-bold text-[#0F172A]">0%</div>
                <div className="text-xs text-[#64748B]">of target</div>
              </div>
            </div>

            {/* Title and Description */}
            <h3 className="text-lg font-bold text-[#0F172A] text-center mb-2">{data.title}</h3>
            <p className="text-sm text-[#64748B] text-center">{data.description}</p>
          </div>
        ))}
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {progressData.map((data, i) => (
          <div
            key={i}
            className="metric-card rounded-2xl p-6 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur border border-white/20 hover:shadow-lg transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${data.gradient} text-white flex items-center justify-center`}
              >
                {i === 0 && <Target className="h-5 w-5" />}
                {i === 1 && <TrendingDown className="h-5 w-5" />}
                {i === 2 && <Zap className="h-5 w-5" />}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: data.color }}>
                  {data.percentage}%
                </div>
                <div className="text-xs text-[#64748B]">Complete</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-[#0F172A]">Progress</span>
                <span className="text-sm text-[#64748B]">
                  {data.current} / {data.target} {data.unit}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: data.color,
                    width: `${data.percentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Status Indicator */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${data.color}15` }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: data.color }}
                />
                <p className="text-xs text-[#0F172A] font-medium">
                  {data.percentage < 50
                    ? 'On track to exceed target'
                    : 'Ahead of schedule'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Call to Action */}
      <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-[#ffdc6e]/10 to-[#ff0027]/10 border border-[#ffdc6e]/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">Ready to set your net-zero goals?</h3>
            <p className="text-[#64748B]">CarbonSite helps you track every tonne and celebrate every reduction.</p>
          </div>
          <button className="px-8 py-3 rounded-full font-semibold transition-all transform hover:scale-105 active:scale-95 bg-gradient-to-r from-[#ffdc6e] to-[#ff0027] text-white whitespace-nowrap">
            Start Tracking Now
          </button>
        </div>
      </div>
    </div>
  );
}
