// @vitest-environment jsdom
import { act, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const use = vi.fn();
const start = vi.fn();
const destroy = vi.fn();
vi.mock("@fiddle-digital/string-tune", () => ({
  StringTune: { getInstance: () => ({ use, start, destroy }) },
  StringProgress: class {},
  StringSplit: class {},
  StringMagnetic: class {},
  StringTilt: class {},
}));
import { StringTuneEffects } from "../string-tune";

let reduced = false;
let listeners = new Set<() => void>();

// Reduced motion can change while the page is open, so the mock keeps the state and notifies listeners.
function media(reduce: boolean, fine = true) {
  reduced = reduce;
  listeners = new Set();
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("reduce") ? reduced : fine;
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
}

function setReduced(on: boolean) {
  reduced = on;
  act(() => listeners.forEach((l) => l()));
}

const on = () => document.documentElement.classList.contains("st-on");

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  vi.clearAllMocks();
});

describe("StringTuneEffects", () => {
  it("does nothing for a visitor who asks for reduced motion", async () => {
    media(true);
    render(<StringTuneEffects />);
    await new Promise((r) => setTimeout(r, 30));
    expect(start).not.toHaveBeenCalled();
    expect(on()).toBe(false);
  });

  it("starts the library, turns the effects on and off again on unmount", async () => {
    media(false);
    const { unmount } = render(<StringTuneEffects />);
    await waitFor(() => expect(on()).toBe(true));
    expect(start).toHaveBeenCalledWith(60);
    expect(use).toHaveBeenCalledTimes(4); // progress, split, magnetic, tilt
    unmount();
    expect(destroy).toHaveBeenCalled();
    expect(on()).toBe(false);
  });

  it("leaves the pointer effects out without a precise pointer", async () => {
    media(false, false);
    render(<StringTuneEffects />);
    await waitFor(() => expect(on()).toBe(true));
    expect(use).toHaveBeenCalledTimes(2);
  });

  it("does not start when reduced motion comes on before the import resolves", async () => {
    media(false);
    render(<StringTuneEffects />);
    setReduced(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(start).not.toHaveBeenCalled();
    expect(on()).toBe(false);
  });

  it("stops when reduced motion comes on and starts again when it goes off", async () => {
    media(false);
    render(<StringTuneEffects />);
    await waitFor(() => expect(on()).toBe(true));
    setReduced(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(on()).toBe(false);
    setReduced(false);
    await waitFor(() => expect(on()).toBe(true));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("starts once reduced motion is switched off after a mount with it on", async () => {
    media(true);
    render(<StringTuneEffects />);
    setReduced(false);
    await waitFor(() => expect(on()).toBe(true));
    expect(start).toHaveBeenCalledTimes(1);
  });
});
