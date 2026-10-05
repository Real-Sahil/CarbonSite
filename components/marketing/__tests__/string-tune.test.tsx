// @vitest-environment jsdom
import { render, waitFor, cleanup } from "@testing-library/react";
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

function media(reduce: boolean, fine = true) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce") ? reduce : fine,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

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
    expect(document.documentElement.classList.contains("st-on")).toBe(false);
  });

  it("starts the library, turns the effects on and off again on unmount", async () => {
    media(false);
    const { unmount } = render(<StringTuneEffects />);
    await waitFor(() => expect(document.documentElement.classList.contains("st-on")).toBe(true));
    expect(start).toHaveBeenCalledWith(60);
    expect(use).toHaveBeenCalledTimes(4); // progress, split, magnetic, tilt
    unmount();
    expect(destroy).toHaveBeenCalled();
    expect(document.documentElement.classList.contains("st-on")).toBe(false);
  });

  it("leaves the pointer effects out without a precise pointer", async () => {
    media(false, false);
    render(<StringTuneEffects />);
    await waitFor(() => expect(document.documentElement.classList.contains("st-on")).toBe(true));
    expect(use).toHaveBeenCalledTimes(2);
  });
});
