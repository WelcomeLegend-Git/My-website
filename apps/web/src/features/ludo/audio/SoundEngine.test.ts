import { afterEach, describe, expect, it, vi } from "vitest";
import { LudoSoundEngine } from "./SoundEngine";

afterEach(() => vi.unstubAllGlobals());

describe("Ludo audio lifecycle", () => {
  it("does not create an audio context from background game events", () => {
    const constructor = vi.fn();
    vi.stubGlobal("AudioContext", constructor);
    const engine = new LudoSoundEngine();
    engine.victory();
    engine.turnChime();
    expect(constructor).not.toHaveBeenCalled();
  });

  it("unlocks only on request, tolerates resume rejection and closes once", async () => {
    const resume = vi.fn(() => Promise.reject(new Error("blocked")));
    const close = vi.fn(() => Promise.resolve());
    const constructor = vi.fn(() => ({ state: "suspended", resume, close }));
    vi.stubGlobal("AudioContext", constructor);
    const engine = new LudoSoundEngine();
    engine.unlock();
    expect(constructor).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
    await Promise.resolve();
    engine.dispose();
    engine.dispose();
    engine.unlock();
    expect(close).toHaveBeenCalledOnce();
    expect(constructor).toHaveBeenCalledOnce();
  });

  it("tolerates unsupported Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    const engine = new LudoSoundEngine();
    expect(() => { engine.unlock(); engine.victory(); engine.dispose(); }).not.toThrow();
  });
});
