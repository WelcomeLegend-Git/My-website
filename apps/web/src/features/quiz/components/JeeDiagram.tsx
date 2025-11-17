import { useEffect, useId, useRef } from 'react';
import JXG from 'jsxgraph';

export type JeeDiagramConfig = {
  boundingBox?: [number, number, number, number];
  axes?: boolean;
  points?: { x: number; y: number; name?: string }[];
  segments?: { from: number; to: number }[];
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
