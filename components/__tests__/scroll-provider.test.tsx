import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const made = vi.hoisted(() => [] as Array<{ destroy: ReturnType<typeof vi.fn> }>);
vi.mock("lenis", () => ({
  default: class {
    raf = vi.fn();
    destroy = vi.fn();
    constructor() {
      made.push(this);
    }
  },
}));
import { ScrollProvider } from "../scroll-provider";

let reduce = false;
let listeners: Array<() => void> = [];

beforeEach(() => {
  reduce = false;
  listeners = [];
  made.length = 0;
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("reduce") && reduce;
    },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      listeners = listeners.filter((l) => l !== fn);
    },
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setReduce(next: boolean) {
  reduce = next;
  listeners.forEach((fn) => fn());
}

describe("ScrollProvider", () => {
  it("does not start Lenis for a visitor who asks for reduced motion", () => {
    reduce = true;
    render(<ScrollProvider>x</ScrollProvider>);
    expect(made).toHaveLength(0);
  });

  it("stops Lenis when reduced motion is switched on and starts it again when switched off", () => {
    render(<ScrollProvider>x</ScrollProvider>);
    expect(made).toHaveLength(1);
    act(() => setReduce(true));
    expect(made[0].destroy).toHaveBeenCalledTimes(1);
    act(() => setReduce(false));
    expect(made).toHaveLength(2);
    expect(made[1].destroy).not.toHaveBeenCalled();
  });

  it("destroys Lenis and removes its listener on unmount", () => {
    const { unmount } = render(<ScrollProvider>x</ScrollProvider>);
    unmount();
    expect(made[0].destroy).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });
});
