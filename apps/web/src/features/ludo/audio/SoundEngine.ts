/**
 * Procedural sound engine for Ludo Arena.
 * All sounds are synthesized in real-time using the Web Audio API — no audio files needed.
 */

type Envelope = { attack: number; decay: number; sustain: number; release: number; peak?: number };

const MASTER_VOLUME = 0.35;

const env = (gain: GainNode, { attack, decay, sustain, release, peak = 1 }: Envelope, startTime: number): void => {
  const g = gain.gain;
  g.setValueAtTime(0.001, startTime);
  g.linearRampToValueAtTime(peak * MASTER_VOLUME, startTime + attack);
  g.linearRampToValueAtTime(sustain * MASTER_VOLUME, startTime + attack + decay);
  g.linearRampToValueAtTime(0.001, startTime + attack + decay + release);
};

const createNoise = (ctx: AudioContext, durationSec: number): AudioBuffer => {
  const length = Math.ceil(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};

export class LudoSoundEngine {
  private ctx: AudioContext | null = null;
  private _muted = false;

  get muted(): boolean { return this._muted; }
  set muted(value: boolean) { this._muted = value; }

  /** Must be called from a user gesture to satisfy browser autoplay policy. */
  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  /* ----- helpers ----- */

  private tone(freq: number, type: OscillatorType, envelope: Envelope, startOffset = 0): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain).connect(ctx.destination);
    env(gain, envelope, t);
    osc.start(t);
    osc.stop(t + envelope.attack + envelope.decay + envelope.release + 0.05);
  }

  private sweep(from: number, to: number, type: OscillatorType, envelope: Envelope, startOffset = 0): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime + startOffset;
    const total = envelope.attack + envelope.decay + envelope.release;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + total);
    osc.connect(gain).connect(ctx.destination);
    env(gain, envelope, t);
    osc.start(t);
    osc.stop(t + total + 0.05);
  }

  private noise(envelope: Envelope, filterFreq: number, startOffset = 0): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime + startOffset;
    const total = envelope.attack + envelope.decay + envelope.release;
    const source = ctx.createBufferSource();
    source.buffer = createNoise(ctx, total + 0.1);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.Q.setValueAtTime(1.2, t);
    const gain = ctx.createGain();
    source.connect(filter).connect(gain).connect(ctx.destination);
    env(gain, envelope, t);
    source.start(t);
    source.stop(t + total + 0.1);
  }

  /* ----- public sounds ----- */

  /** Tactile dice clatter. */
  diceRoll(): void {
    this.noise({ attack: 0.01, decay: 0.06, sustain: 0.4, release: 0.22, peak: 0.9 }, 3200);
    this.noise({ attack: 0.04, decay: 0.05, sustain: 0.2, release: 0.15, peak: 0.5 }, 1800, 0.06);
    this.noise({ attack: 0.02, decay: 0.03, sustain: 0.15, release: 0.1, peak: 0.35 }, 4500, 0.12);
  }

  /** Short wooden click when a token lands. */
  tokenMove(): void {
    this.tone(800, "sine", { attack: 0.003, decay: 0.04, sustain: 0.1, release: 0.06, peak: 0.6 });
    this.tone(1200, "sine", { attack: 0.001, decay: 0.02, sustain: 0.0, release: 0.03, peak: 0.2 });
  }

  /** Impact + shatter on capture. */
  tokenCapture(): void {
    this.tone(80, "sine", { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.18, peak: 1.0 });
    this.noise({ attack: 0.01, decay: 0.04, sustain: 0.3, release: 0.25, peak: 0.8 }, 5000, 0.02);
    this.tone(220, "sawtooth", { attack: 0.01, decay: 0.06, sustain: 0.1, release: 0.12, peak: 0.3 }, 0.03);
  }

  /** Ascending sparkle when a token finishes. */
  tokenFinish(): void {
    this.tone(523, "sine", { attack: 0.01, decay: 0.06, sustain: 0.3, release: 0.12, peak: 0.5 });
    this.tone(659, "sine", { attack: 0.01, decay: 0.06, sustain: 0.3, release: 0.12, peak: 0.5 }, 0.09);
    this.tone(784, "sine", { attack: 0.01, decay: 0.06, sustain: 0.4, release: 0.18, peak: 0.6 }, 0.18);
  }

  /** Bright upward sweep on rolling a six. */
  sixRoll(): void {
    this.sweep(400, 1200, "sine", { attack: 0.01, decay: 0.04, sustain: 0.2, release: 0.12, peak: 0.55 });
    this.sweep(600, 1800, "triangle", { attack: 0.02, decay: 0.03, sustain: 0.1, release: 0.1, peak: 0.2 }, 0.03);
  }

  /** Soft bell chime on turn change. */
  turnChime(): void {
    this.tone(1046, "sine", { attack: 0.005, decay: 0.08, sustain: 0.15, release: 0.12, peak: 0.3 });
    this.tone(2093, "sine", { attack: 0.005, decay: 0.06, sustain: 0.05, release: 0.08, peak: 0.1 });
  }

  /** 4-note ascending victory fanfare. */
  victory(): void {
    const e: Envelope = { attack: 0.02, decay: 0.06, sustain: 0.4, release: 0.22, peak: 0.5 };
    this.tone(523, "sine", e, 0);        // C5
    this.tone(659, "sine", e, 0.18);     // E5
    this.tone(784, "sine", e, 0.36);     // G5
    this.tone(1046, "sine", { ...e, release: 0.5, peak: 0.65 }, 0.54); // C6
    // Harmony
    this.tone(392, "triangle", { attack: 0.03, decay: 0.05, sustain: 0.2, release: 0.6, peak: 0.15 }, 0);
    this.tone(523, "triangle", { attack: 0.03, decay: 0.05, sustain: 0.2, release: 0.6, peak: 0.15 }, 0.36);
  }

  /** Micro click for UI buttons. */
  uiClick(): void {
    this.tone(2000, "sine", { attack: 0.001, decay: 0.01, sustain: 0.0, release: 0.015, peak: 0.25 });
  }

  dispose(): void {
    this.ctx?.close();
    this.ctx = null;
  }
}
