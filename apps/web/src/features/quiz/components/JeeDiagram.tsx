import { useEffect, useId, useRef } from 'react';
import JXG from 'jsxgraph';

export type JeeDiagramConfig = {
  boundingBox?: [number, number, number, number];
  axes?: boolean;
  points?: { x: number; y: number; name?: string; visible?: boolean }[];
  segments?: { from: number; to: number; strokeColor?: string; strokeWidth?: number; dash?: number }[];
  polylines?: { points: number[]; strokeColor?: string; strokeWidth?: number }[];
  polygons?: { vertices: number[]; strokeColor?: string; fillColor?: string; strokeWidth?: number }[];
  circles?: { center: number; radius: number; strokeColor?: string; fillColor?: string }[];
  arcs?: { center: number; from: number; to: number; strokeColor?: string; strokeWidth?: number }[];
  fieldRegions?: { x1: number; y1: number; x2: number; y2: number; pattern: 'cross' | 'dot'; density?: number }[];
  labels?: { x: number; y: number; text: string; color?: string }[];
  arrows?: { from: number; to: number; label?: string; color?: string }[];
  springs?: { from: number; to: number; coils?: number }[];
  angles?: { center: number; p1: number; p2: number; label?: string; radius?: number }[];
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
    const boundingBox = cfg.boundingBox ?? [-6, 4, 6, -4];
    const showAxes = cfg.axes !== false;

    // Initialize board with professional settings
    const board = JXG.JSXGraph.initBoard(containerId, {
      boundingbox: boundingBox,
      axis: showAxes,
      showNavigation: false,
      showCopyright: false,
      pan: { enabled: true },
      zoom: { enabled: true },
      grid: false, // Custom grid looks better usually, or just axis
      backgroundColor: 'transparent',
    } as any);

    boardRef.current = board;

    const points: JXG.Point[] = [];

    // 1. Points (Hidden by default unless named or specified)
    (cfg.points || []).forEach((p) => {
      const point = board.create('point', [p.x, p.y], {
        name: p.name ?? '',
        size: p.visible === false ? 0 : 2,
        strokeColor: '#cbd5e1', // slate-300
        fillColor: '#cbd5e1',
        fixed: true,
        visible: p.visible !== false,
        withLabel: !!p.name,
        label: { offset: [5, 5], color: '#cbd5e1' }
      });
      points.push(point);
    });

    // 2. Polygons (Bodies/Blocks)
    (cfg.polygons || []).forEach((poly) => {
      const ps = (poly.vertices || []).map((idx) => points[idx]).filter((p): p is JXG.Point => !!p);
      if (ps.length >= 3) {
        board.create('polygon', ps, {
          strokeColor: poly.strokeColor ?? '#94a3b8', // slate-400
          strokeWidth: poly.strokeWidth ?? 2,
          fillColor: poly.fillColor ?? '#334155', // slate-700
          fillOpacity: 0.3,
          highlight: false,
        } as any);
      }
    });

    // 3. Segments / Lines
    (cfg.segments || []).forEach((seg) => {
      const from = points[seg.from];
      const to = points[seg.to];
      if (from && to) {
        board.create('segment', [from, to], {
          strokeColor: seg.strokeColor ?? '#e2e8f0', // slate-200
          strokeWidth: seg.strokeWidth ?? 2,
          dash: seg.dash ?? 0,
          highlight: false,
        });
      }
    });

    // 4. Arrows (Vectors/Forces)
    (cfg.arrows || []).forEach((arrow) => {
      const from = points[arrow.from];
      const to = points[arrow.to];
      if (from && to) {
        const line = board.create('arrow', [from, to], {
          strokeColor: arrow.color ?? '#38bdf8', // sky-400
          strokeWidth: 3,
          highlight: false,
          fixed: true,
        });

        if (arrow.label) {
          board.create('text', [
            () => (from.X() + to.X()) / 2,
            () => (from.Y() + to.Y()) / 2,
            arrow.label
          ], {
            anchorX: 'middle',
            anchorY: 'bottom',
            color: arrow.color ?? '#38bdf8',
            fontSize: 14,
            parse: false, // We handle MathJax manually
            offset: [0, 10]
          });
        }
      }
    });

    // 5. Circles
    (cfg.circles || []).forEach((c) => {
      const center = points[c.center];
      if (center && typeof c.radius === 'number' && c.radius > 0) {
        board.create('circle', [center, c.radius], {
          strokeColor: c.strokeColor ?? '#fbbf24', // amber-400
          fillColor: c.fillColor ?? '#fbbf24',
          fillOpacity: 0.1,
          strokeWidth: 2,
          highlight: false,
        } as any);
      }
    });

    // 6. Arcs
    (cfg.arcs || []).forEach((a) => {
      const center = points[a.center];
      const from = points[a.from];
      const to = points[a.to];
      if (center && from && to) {
        board.create('arc', [center, from, to], {
          strokeColor: a.strokeColor ?? '#f97316', // orange-500
          strokeWidth: a.strokeWidth ?? 2,
          highlight: false,
        } as any);
      }
    });

    // 7. Springs (Improved visual)
    (cfg.springs || []).forEach((s) => {
      const from = points[s.from];
      const to = points[s.to];
      if (!from || !to) return;

      const coils = Math.max(3, Math.min(15, s.coils ?? 8));
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
      const amplitude = Math.min(len * 0.15, 0.4); // Slightly wider
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
        strokeColor: '#facc15', // yellow-400
        strokeWidth: 2,
        highlight: false,
      } as any);
    });

    // 8. Field Regions
    (cfg.fieldRegions || []).forEach((region) => {
      const { x1, y1, x2, y2, pattern } = region;
      const density = Math.max(2, Math.min(8, region.density ?? 4));

      board.create('polygon', [
        [x1, y1], [x2, y1], [x2, y2], [x1, y2],
      ], {
        fillColor: '#94a3b8',
        strokeColor: 'transparent',
        fillOpacity: 0.1,
        highlight: false,
      } as any);

      for (let i = 0; i < density; i++) {
        const tx = (i + 0.5) / density;
        const x = x1 + tx * (x2 - x1);
        for (let j = 0; j < density; j++) {
          const ty = (j + 0.5) / density;
          const y = y1 + ty * (y2 - y1);
          const symbol = pattern === 'dot' ? '⊙' : '×'; // Better symbols
          board.create('text', [x, y, symbol], {
            anchorX: 'middle',
            anchorY: 'middle',
            strokeColor: '#9ca3af',
            fontSize: 12,
            highlight: false,
          } as any);
        }
      }
    });

    // 9. Labels (MathJax support)
    (cfg.labels || []).forEach((label) => {
      board.create('text', [label.x, label.y, label.text], {
        anchorX: 'left',
        anchorY: 'top',
        strokeColor: label.color ?? '#e2e8f0',
        fontSize: 14,
        highlight: false,
        parse: false, // Important for MathJax
      } as any);
    });

    // 10. Angles
    (cfg.angles || []).forEach((angle) => {
      const center = points[angle.center];
      const p1 = points[angle.p1];
      const p2 = points[angle.p2];
      if (center && p1 && p2) {
        board.create('angle', [p1, center, p2], {
          radius: angle.radius ?? 1,
          fillColor: '#f472b6', // pink-400
          fillOpacity: 0.2,
          strokeColor: '#f472b6',
          strokeWidth: 1,
          name: angle.label ?? '',
          withLabel: !!angle.label,
          label: { color: '#f472b6' }
        } as any);
      }
    });

    // Trigger MathJax
    if (typeof window !== 'undefined' && window.MathJax && containerRef.current) {
      setTimeout(() => {
        window.MathJax?.typesetPromise?.([containerRef.current!]).catch(() => { });
      }, 100);
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

  if (!diagram || (diagram.type && diagram.type !== 'jsxgraph')) {
    return null;
  }

  return (
    <div className="space-y-2">
      {(diagram.title || diagram.description) && (
        <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
          {diagram.title && <div className="font-semibold text-slate-100 mb-1">{diagram.title}</div>}
          {diagram.description && <div className="text-slate-400 text-xs">{diagram.description}</div>}
        </div>
      )}
      <div
        id={containerId}
        ref={containerRef}
        className="w-full h-80 rounded-xl bg-[#0f172a] border border-slate-700/50 overflow-hidden shadow-inner relative"
      >
        {/* Watermark/Grid hint could go here */}
      </div>
    </div>
  );
};

