import { useCallback, useEffect, useRef } from "react";

import { emitParticles, renderParticle, updateParticle, type Particle, type ParticlePreset } from "./particles";

export interface ParticleAPI {
  bindCanvas: (el: HTMLCanvasElement | null) => void;
  emit: (preset: ParticlePreset, origin: { x: number; y: number }, color?: string) => void;
}

export const useParticles = (): ParticleAPI => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null) as React.MutableRefObject<HTMLCanvasElement | null>;
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const bindCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  const loop = useCallback(function loop(time: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 0.016;
    lastTimeRef.current = time;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = particlesRef.current.filter((p) => {
      const alive = updateParticle(p, dt);
      if (alive) renderParticle(ctx, p);
      return alive;
    });

    if (particlesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      rafRef.current = 0;
    }
  }, []);

  const emit = useCallback(
    (preset: ParticlePreset, origin: { x: number; y: number }, color?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const newParticles = emitParticles(preset, origin, { w: canvas.width, h: canvas.height }, color);
      particlesRef.current.push(...newParticles);
      if (!rafRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [loop],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { bindCanvas, emit };
};
