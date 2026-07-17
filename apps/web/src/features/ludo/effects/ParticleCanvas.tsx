import { useEffect, useRef } from "react";

import type { ParticleAPI } from "../effects/useParticles";

interface ParticleCanvasProps {
  particles: ParticleAPI;
}

export const ParticleCanvas = ({ particles }: ParticleCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = particles.canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = (): void => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [particles.canvasRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={particles.canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
};
