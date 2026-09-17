import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useParticles } from "./useParticles";
import { emitParticles } from "./particles";

vi.mock("./particles", () => ({ emitParticles: vi.fn(() => [{ life: 1 }]), updateParticle: vi.fn(() => false), renderParticle: vi.fn() }));
let id = 0;
let preferenceChanged: () => void;
let reduced = false;
const canvas = () => ({
  width: 1200, height: 1200,
  getBoundingClientRect: () => ({ width: 600, height: 600 }),
  getContext: () => ({ save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn() }),
}) as unknown as HTMLCanvasElement;

beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, cb: () => void) => { preferenceChanged = cb; }, removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => ++id));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Particle lifecycle", () => {
  it("keeps the API stable across ordinary renders", () => {
    const { result, rerender } = renderHook(useParticles);
    const api = result.current;
    rerender();
    expect(result.current).toBe(api);
  });

  it("uses logical CSS pixels rather than the HiDPI backing size", () => {
    const { result } = renderHook(useParticles);
    act(() => { result.current.bindCanvas(canvas()); result.current.emit("victory", { x: 300, y: 0 }); });
    expect(emitParticles).toHaveBeenCalledWith("victory", { x: 300, y: 0 }, { w: 600, h: 600 }, undefined);
  });

  it("cancels on detach and starts a fresh RAF after reattach", () => {
    const { result, unmount } = renderHook(useParticles);
    act(() => { result.current.bindCanvas(canvas()); result.current.emit("six", { x: 0, y: 0 }); });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => result.current.bindCanvas(null));
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => { result.current.bindCanvas(canvas()); result.current.emit("six", { x: 0, y: 0 }); });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("stops immediately when reduced motion is enabled", () => {
    const { result } = renderHook(useParticles);
    act(() => { result.current.bindCanvas(canvas()); result.current.emit("six", { x: 0, y: 0 }); });
    act(() => { reduced = true; preferenceChanged(); });
    expect(cancelAnimationFrame).toHaveBeenCalled();
    vi.mocked(requestAnimationFrame).mockClear();
    act(() => result.current.emit("victory", { x: 0, y: 0 }));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
