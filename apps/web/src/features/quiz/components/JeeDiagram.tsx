import { useEffect, useId, useRef } from 'react';
import JXG from 'jsxgraph';

export type JeeDiagramConfig = {
  boundingBox?: [number, number, number, number];
  axes?: boolean;
  points?: { x: number; y: number; name?: string }[];
  segments?: { from: number; to: number }[];
  polylines?: { points: number[]; strokeColor?: string; strokeWidth?: number }[];
  polygons?: { vertices: number[]; strokeColor?: string; fillColor?: string; strokeWidth?: number }[];
  circles?: { center: number; radius: number; strokeColor?: string; fillColor?: string }[];
  arcs?: { center: number; from: number; to: number; strokeColor?: string; strokeWidth?: number }[];
  fieldRegions?: { x1: number; y1: number; x2: number; y2: number; pattern: 'cross' | 'dot'; density?: number }[];
  labels?: { x: number; y: number; text: string }[];
  arrows?: { from: number; to: number; label?: string }[];
  springs?: { from: number; to: number; coils?: number }[];
};

export type JeeDiagramSpec = {
  type?: string; // expected 'jsxgraph'
  title?: string;
  description?: string;
  config?: JeeDiagramConfig;
};

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: Array<HTMLElement | string>) => Promise<void>;
    };
  }
}

export const JeeDiagram = ({ diagram }: { diagram: JeeDiagramSpec }) => {
  const id = useId().replace(/:/g, '-');
  const containerId = `jee-diagram-${id}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<JXG.Board | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any previous board
    if (boardRef.current) {
      try {
        JXG.JSXGraph.freeBoard(boardRef.current);
      } catch {
        // ignore
      }
      boardRef.current = null;
    }

    const cfg: JeeDiagramConfig = diagram?.config || {};
    const boundingBox = cfg.boundingBox ?? [-5, 5, 5, -5];
    const showAxes = cfg.axes !== false;

    const board = JXG.JSXGraph.initBoard(containerId, {
      boundingbox: boundingBox,
      axis: showAxes,
      showNavigation: false,
      showCopyright: false,
      pan: { enabled: true },
      zoom: { enabled: true },
    } as any);

    boardRef.current = board;

    const points: JXG.Point[] = [];

    // Points
    (cfg.points || []).forEach((p) => {
      const point = board.create('point', [p.x, p.y], {
        name: p.name ?? '',
        size: 2,
        strokeColor: '#60a5fa',
        fillColor: '#60a5fa',
        fixed: true,
      });
      points.push(point);
    });

    // Segments / lines between points by index
    (cfg.segments || []).forEach((seg) => {
      const from = points[seg.from];
      const to = points[seg.to];
      if (from && to) {
        board.create('segment', [from, to], {
          strokeColor: '#a855f7',
          strokeWidth: 2,
        });
      }
    });

    (cfg.polylines || []).forEach((pl) => {
      const ps = (pl.points || []).map((idx) => points[idx]).filter((p): p is JXG.Point => !!p);
      if (ps.length >= 2) {
        const xs = ps.map((p) => p.X());
        const ys = ps.map((p) => p.Y());
        board.create('curve', [xs, ys], {
          strokeColor: pl.strokeColor ?? '#e5e7eb',
          strokeWidth: pl.strokeWidth ?? 2,
          straightFirst: true,
          straightLast: true,
        } as any);
      }
    });

    (cfg.polygons || []).forEach((poly) => {
      const ps = (poly.vertices || []).map((idx) => points[idx]).filter((p): p is JXG.Point => !!p);
      if (ps.length >= 3) {
        board.create('polygon', ps, {
          strokeColor: poly.strokeColor ?? '#9ca3af',
          strokeWidth: poly.strokeWidth ?? 2,
          fillColor: poly.fillColor ?? 'rgba(148, 163, 184, 0.08)',
        } as any);
      }
    });

    (cfg.circles || []).forEach((c) => {
      const center = points[c.center];
      if (center && typeof c.radius === 'number' && c.radius > 0) {
        const radiusPoint = board.create('point', [center.X() + c.radius, center.Y()], {
          visible: false,
          fixed: true,
        });
        board.create('circle', [center, radiusPoint], {
          strokeColor: c.strokeColor ?? '#fbbf24',
          fillColor: c.fillColor ?? 'rgba(250, 204, 21, 0.08)',
        } as any);
      }
    });

    (cfg.arcs || []).forEach((a) => {
      const center = points[a.center];
      const from = points[a.from];
      const to = points[a.to];
      if (center && from && to) {
        board.create('arc', [center, from, to], {
          strokeColor: a.strokeColor ?? '#f97316',
          strokeWidth: a.strokeWidth ?? 2,
        } as any);
      }
    });

    (cfg.springs || []).forEach((s) => {
      const from = points[s.from];
      const to = points[s.to];
      if (!from || !to) return;

      const coils = Math.max(3, Math.min(12, s.coils ?? 6));
      const x1 = from.X();
      const y1 = from.Y();
      const x2 = to.X();
      const y2 = to.Y();
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) return;

      const ux = dx / len;
      const uy = dy / len;
      const vx = -uy;
      const vy = ux;
      const amplitude = Math.min(len * 0.1, 0.8);
      const step = len / (coils * 2);

      const xs: number[] = [x1];
      const ys: number[] = [y1];

      for (let i = 1; i <= coils * 2 - 1; i++) {
        const t = step * i;
        const baseX = x1 + ux * t;
        const baseY = y1 + uy * t;
        const dir = i % 2 === 0 ? -1 : 1;
        xs.push(baseX + vx * amplitude * dir);
        ys.push(baseY + vy * amplitude * dir);
      }

      xs.push(x2);
      ys.push(y2);

      board.create('curve', [xs, ys], {
        strokeColor: '#facc15',
        strokeWidth: 2,
      } as any);
    });

    (cfg.fieldRegions || []).forEach((region) => {
      const { x1, y1, x2, y2, pattern } = region;
      const density = Math.max(2, Math.min(8, region.density ?? 4));

      board.create('polygon', [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ], {
        fillColor: 'rgba(148, 163, 184, 0.06)',
        strokeColor: 'rgba(148, 163, 184, 0.4)',
        fillOpacity: 0.2,
      } as any);

      for (let i = 0; i < density; i++) {
        const tx = (i + 0.5) / density;
        const x = x1 + tx * (x2 - x1);
        for (let j = 0; j < density; j++) {
          const ty = (j + 0.5) / density;
          const y = y1 + ty * (y2 - y1);
          const symbol = pattern === 'dot' ? '•' : '×';
          board.create('text', [x, y, symbol], {
            anchorX: 'middle',
            anchorY: 'middle',
            strokeColor: '#9ca3af',
            fontSize: 10,
          } as any);
        }
      }
    });

    (cfg.labels || []).forEach((label) => {
      board.create('text', [label.x, label.y, label.text], {
        anchorX: 'left',
        anchorY: 'top',
        strokeColor: '#e5e7eb',
        fontSize: 12,
      } as any);
    });

    // Trigger MathJax only inside this container (for labels using \( ... \))
    if (typeof window !== 'undefined' && window.MathJax && containerRef.current) {
      window.MathJax.typesetPromise?.([containerRef.current]).catch(() => {
        // ignore MathJax errors
      });
    }

    return () => {
      if (boardRef.current) {
        try {
          JXG.JSXGraph.freeBoard(boardRef.current);
        } catch {
          // ignore
        }
        boardRef.current = null;
      }
    };
  }, [containerId, diagram]);

  if (!diagram || diagram.type && diagram.type !== 'jsxgraph') {
    return null;
  }

  return (
    <div className="space-y-2">
      {(diagram.title || diagram.description) && (
        <div className="text-xs text-slate-300">
          {diagram.title && <div className="font-semibold mb-0.5">{diagram.title}</div>}
          {diagram.description && <div className="text-slate-400">{diagram.description}</div>}
        </div>
      )}
      <div
        id={containerId}
        ref={containerRef}
        className="w-full h-64 rounded-lg bg-slate-900/70 border border-slate-700/70 overflow-hidden"
      />
    </div>
  );
};
