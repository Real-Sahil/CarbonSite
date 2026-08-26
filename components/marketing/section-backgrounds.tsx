"use client";

import {
  ConstellationField,
  StreamConvergenceBackground,
  DefenseLines,
  TopoField,
  GatewayFlow,
  ParticleNetwork,
} from "@designcodeio/threeui";
import RisingLines from "@/components/originkit/rising-lines";
import WaveArcs from "@/components/originkit/wave-arcs";

// Home — capabilities section
export function CapabilitiesBg() {
  return (
    <ConstellationField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={25}
      saturation={0.65}
      brightness={0.45}
      speed={0.3}
      density={0.7}
      opacity={0.55}
    />
  );
}

// Home — how-it-works section (Refero WaveArcs — cursor-reactive amber arcs)
export function HowItWorksBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <WaveArcs
        backgroundColor="#1C1A2E"
        lineColor="rgb(245, 158, 11)"
        lineWidth={0.9}
        lineCount={55}
        speed={3.5}
        glow={9}
        interactive={false}
      />
    </div>
  );
}

// Home — CTA section (Refero RisingLines — warm burnt-orange rising particles)
export function CtaBg() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <RisingLines
        particles={380}
        color="#f97316"
        backgroundColor="#1C1A2E"
        horizonColor="#e76f51"
        riseSpeed={18}
        opacity={72}
        horizonOpacity={52}
        scale={7}
        showHorizon={true}
      />
    </div>
  );
}

// Security — hero section
export function SecurityHeroBg() {
  return (
    <DefenseLines
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={20}
      saturation={0.6}
      brightness={0.45}
      speed={0.3}
      opacity={0.6}
    />
  );
}

// Security — CTA section
export function SecurityCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={15}
      saturation={0.7}
      brightness={0.45}
      speed={0.4}
      opacity={0.5}
    />
  );
}

// Product — hero section
export function ProductHeroBg() {
  return (
    <TopoField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={30}
      saturation={0.65}
      brightness={0.45}
      speed={0.25}
      opacity={0.6}
    />
  );
}

// Product — role access section
export function ProductRolesBg() {
  return (
    <ConstellationField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={25}
      saturation={0.5}
      brightness={0.3}
      speed={0.2}
      opacity={0.35}
    />
  );
}

// Product — CTA section
export function ProductCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={15}
      saturation={0.75}
      brightness={0.5}
      speed={0.45}
      opacity={0.55}
    />
  );
}

// Field App — hero section
export function FieldAppHeroBg() {
  return (
    <GatewayFlow
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={35}
      saturation={0.7}
      brightness={0.5}
      speed={0.35}
      opacity={0.65}
    />
  );
}

// Field App — OCR section
export function FieldAppOcrBg() {
  return (
    <ParticleNetwork
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={30}
      saturation={0.5}
      brightness={0.3}
      speed={0.2}
      opacity={0.3}
    />
  );
}

// Field App — CTA section
export function FieldAppCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={15}
      saturation={0.7}
      brightness={0.45}
      speed={0.4}
      opacity={0.5}
    />
  );
}
