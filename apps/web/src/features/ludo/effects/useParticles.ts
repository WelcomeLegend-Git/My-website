import { useCallback, useEffect, useMemo, useRef } from "react";
import { emitParticles, renderParticle, updateParticle, type Particle, type ParticlePreset } from "./particles";
import { useLudoReducedMotion } from "./useLudoReducedMotion";

export interface ParticleAPI {
  bindCanvas: (el: HTMLCanvasElement | null) => void;
  emit: (preset: ParticlePreset, origin: { x: number; y: number }, color?: string) => void;
  clear: () => void;
}

export const useParticles = (): ParticleAPI => {
  const reducedMotion = useLudoReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTimeRef.current = null;
    particlesRef.current = [];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, []);

  const bindCanvas = useCallback((el: HTMLCanvasElement | null) => {
    clear();
    canvasRef.current = el;
  }, [clear]);

  const loop = useCallback(function frame(time: number) {
    rafRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { clear(); return; }
    const dt = lastTimeRef.current === null ? 0.016 : Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    particlesRef.current = particlesRef.current.filter((particle) => {
      const alive = updateParticle(particle, dt);
      if (alive) renderParticle(ctx, particle);
      return alive;
    });
    if (particlesRef.current.length) rafRef.current = requestAnimationFrame(frame);
    else lastTimeRef.current = null;
  }, [clear]);

  const emit = useCallback((preset: ParticlePreset, origin: { x: number; y: number }, color?: string) => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion || document.hidden) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    particlesRef.current.push(...emitParticles(preset, origin, { w: width, h: height }, color));
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
  }, [loop, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) clear();
    const onVisibility = (): void => { if (document.hidden) clear(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); clear(); };
  }, [clear, reducedMotion]);

  return useMemo(() => ({ bindCanvas, emit, clear }), [bindCanvas, emit, clear]);
};
