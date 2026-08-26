"use client";

import {
  ConstellationField,
  InterfaceLines,
  StreamConvergenceBackground,
  DefenseLines,
  TopoField,
  GatewayFlow,
  ParticleNetwork,
} from "@designcodeio/threeui";

export function CapabilitiesBg() {
  return (
    <ConstellationField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.6}
      brightness={0.4}
      speed={0.3}
      density={0.7}
      opacity={0.55}
    />
  );
}

export function HowItWorksBg() {
  return (
    <InterfaceLines
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.5}
      brightness={0.35}
      speed={0.25}
      opacity={0.4}
    />
  );
}

export function CtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={174}
      saturation={0.75}
      brightness={0.55}
      speed={0.5}
      opacity={0.65}
    />
  );
}

export function SecurityHeroBg() {
  return (
    <DefenseLines
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.6}
      brightness={0.45}
      speed={0.3}
      opacity={0.6}
    />
  );
}

export function SecurityCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={174}
      saturation={0.7}
      brightness={0.45}
      speed={0.4}
      opacity={0.5}
    />
  );
}

export function ProductHeroBg() {
  return (
    <TopoField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.65}
      brightness={0.45}
      speed={0.25}
      opacity={0.6}
    />
  );
}

export function ProductRolesBg() {
  return (
    <ConstellationField
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.5}
      brightness={0.3}
      speed={0.2}
      opacity={0.35}
    />
  );
}

export function ProductCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={174}
      saturation={0.75}
      brightness={0.5}
      speed={0.45}
      opacity={0.55}
    />
  );
}

export function FieldAppHeroBg() {
  return (
    <GatewayFlow
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.7}
      brightness={0.5}
      speed={0.35}
      opacity={0.65}
    />
  );
}

export function FieldAppOcrBg() {
  return (
    <ParticleNetwork
      className="absolute inset-0 w-full h-full"
      mode="dark"
      hue={174}
      saturation={0.5}
      brightness={0.3}
      speed={0.2}
      opacity={0.3}
    />
  );
}

export function FieldAppCtaBg() {
  return (
    <StreamConvergenceBackground
      className="absolute inset-0 w-full h-full"
      hue={174}
      saturation={0.7}
      brightness={0.45}
      speed={0.4}
      opacity={0.5}
    />
  );
}
