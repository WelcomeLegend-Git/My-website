import { useMemo, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export type JeeDiagramConfig = {
  boundingBox?: [number, number, number, number];
  axes?: boolean;
  points?: { x: number; y: number; name?: string; visible?: boolean }[];
  segments?: { from: number; to: number; strokeColor?: string; strokeWidth?: number; dash?: number }[];
  polylines?: { points: number[]; strokeColor?: string; strokeWidth?: number }[];
  polygons?: { vertices: number[]; strokeColor?: string; fillColor?: string; strokeWidth?: number }[];
  circles?: { center: number; radius: number; strokeColor?: string; fillColor?: string }[];
  arcs?: { center: number; from: number; to: number; strokeColor?: string; strokeWidth?: number }[];
  fieldRegions?: { x1: number; y1: number; x2: number; y2: number; pattern: 'cross' | 'dot' | 'hatch'; density?: number }[];
  labels?: { x: number; y: number; text: string; color?: string }[];
  arrows?: { from: number; to: number; label?: string; color?: string }[];
  springs?: { from: number; to: number; coils?: number }[];
  angles?: { center: number; p1: number; p2: number; label?: string; radius?: number }[];
};

export type JeeDiagramSpec = {
  type?: string;
  title?: string;
  description?: string;
  config?: JeeDiagramConfig;
};

const THEME = {
  colors: {
    background: '#ffffff',
    grid: '#f1f5f9', // slate-100
    axis: '#94a3b8', // slate-400
    text: '#1e293b', // slate-800
    primary: '#1e3a8a', // blue-900 (Gemini style)
    secondary: '#dc2626', // red-600
    fill: '#e0f2fe', // sky-100 (Gemini object fill)
    stroke: '#1e3a8a', // blue-900
    ground: '#94a3b8', // slate-400
  },
  fonts: {
    math: 'font-serif italic',
    label: 'font-sans',
  }
};

export const JeeDiagram = ({ diagram }: { diagram: JeeDiagramSpec }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const cfg = diagram?.config || {};
  // Default bounding box if missing
  const boundingBox = cfg.boundingBox || [-6, 4, 6, -4]; // [minX, maxY, maxX, minY]
  const [minX, maxY, maxX, minY] = boundingBox;

  // Coordinate transformation
  // Math coords: X right, Y up
  // SVG coords: X right, Y down
  const toSVG = (x: number, y: number) => {
    // Add 10% padding to internal calculation to prevent cutting off edges
    const width = maxX - minX;
    const height = maxY - minY;

    const scaleX = dimensions.width / width;
    const scaleY = dimensions.height / height;

    // We want to maintain aspect ratio if possible, or just stretch?
    // Usually diagrams need aspect ratio. Let's use the smaller scale to fit.
    // But for now, let's stretch to fill container as requested by "responsive".

    return {
      x: (x - minX) * scaleX,
      y: (maxY - y) * scaleY,
    };
  };

  // Calculate a uniform scale for things like radii to ensure circles look circular
  // regardless of aspect ratio distortion (though we ideally want 1:1 aspect)
  const scaleX = dimensions.width / (maxX - minX);
  const scale = scaleX;

  const points = cfg.points || [];
  const getPt = (idx: number) => {
    const p = points[idx];
    return p ? toSVG(p.x, p.y) : { x: 0, y: 0 };
  };

  // Helper to ensure LaTeX is rendered even if AI forgets $ delimiters
  const formatMath = (text: string) => {
    if (!text) return "";
    // If text contains backslashes (LaTeX commands) but no $, wrap it.
    // Also handle common Greek letters or math symbols if they appear as plain text.
    if ((text.includes('\\') || text.match(/[=><]/)) && !text.includes('$')) {
      return `$${text}$`;
    }
    return text;
  };

  if (!diagram) return null;

  return (
    <div className="space-y-3 font-sans">
      {(diagram.title || diagram.description) && (
        <div className="bg-slate-50 border-l-4 border-blue-600 p-4 rounded-r-lg shadow-sm">
          {diagram.title && <div className="font-bold text-slate-900 text-base">{diagram.title}</div>}
          {diagram.description && <div className="text-slate-600 text-sm mt-1">{diagram.description}</div>}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full h-96 bg-white rounded-xl border border-slate-200 overflow-hidden select-none shadow-inner"
      >
        {dimensions.width > 0 && (
          <svg
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="block w-full h-full"
          >
            <defs>
              {/* Arrowhead Marker - Blue */}
              <marker id="arrowhead-blue" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                <path d="M2,2 L10,6 L2,10 L4,6 Z" fill={THEME.colors.primary} />
              </marker>
              {/* Arrowhead Marker - Red */}
              <marker id="arrowhead-red" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                <path d="M2,2 L10,6 L2,10 L4,6 Z" fill={THEME.colors.secondary} />
              </marker>
              {/* Arrowhead Marker - Black/Text */}
              <marker id="arrowhead-text" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                <path d="M2,2 L10,6 L2,10 L4,6 Z" fill={THEME.colors.text} />
              </marker>

              {/* Ground Hatching Pattern */}
              <pattern id="hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" stroke={THEME.colors.ground} strokeWidth="1" />
              </pattern>

              {/* Dot Pattern */}
              <pattern id="dot" patternUnits="userSpaceOnUse" width="12" height="12">
                <circle cx="6" cy="6" r="1.5" fill={THEME.colors.ground} />
              </pattern>

              {/* Cross Pattern */}
              <pattern id="cross" patternUnits="userSpaceOnUse" width="12" height="12">
                <path d="M3,3 L9,9 M9,3 L3,9" stroke={THEME.colors.ground} strokeWidth="1.5" />
              </pattern>
            </defs>

            {/* Grid/Axes - Made more subtle */}
            {cfg.axes !== false && (
              <g className="axes opacity-50">
                {/* Grid Lines */}
                {Array.from({ length: Math.ceil(maxX - minX) + 1 }).map((_, i) => {
                  const x = minX + i;
                  const p = toSVG(x, 0);
                  return <line key={`gx-${i}`} x1={p.x} y1={0} x2={p.x} y2={dimensions.height} stroke={THEME.colors.grid} strokeWidth="1" />;
                })}
                {Array.from({ length: Math.ceil(maxY - minY) + 1 }).map((_, i) => {
                  const y = minY + i;
                  const p = toSVG(0, y);
                  return <line key={`gy-${i}`} x1={0} y1={p.y} x2={dimensions.width} y2={p.y} stroke={THEME.colors.grid} strokeWidth="1" />;
                })}

                {/* Main Axes */}
                {minY <= 0 && maxY >= 0 && (
                  <line x1={0} y1={toSVG(0, 0).y} x2={dimensions.width} y2={toSVG(0, 0).y} stroke={THEME.colors.axis} strokeWidth="2" />
                )}
                {minX <= 0 && maxX >= 0 && (
                  <line x1={toSVG(0, 0).x} y1={0} x2={toSVG(0, 0).x} y2={dimensions.height} stroke={THEME.colors.axis} strokeWidth="2" />
                )}
              </g>
            )}

            {/* Field Regions (Ground, etc) */}
            {(cfg.fieldRegions || []).map((region, i) => {
              const rMinX = Math.min(region.x1, region.x2);
              const rMaxX = Math.max(region.x1, region.x2);
              const rMinY = Math.min(region.y1, region.y2);
              const rMaxY = Math.max(region.y1, region.y2);

              const tl = toSVG(rMinX, rMaxY);
              const br = toSVG(rMaxX, rMinY);

              let patternUrl = 'url(#hatch)';
              if (region.pattern === 'dot') patternUrl = 'url(#dot)';
              if (region.pattern === 'cross') patternUrl = 'url(#cross)';

              return (
                <rect
                  key={`region-${i}`}
                  x={tl.x}
                  y={tl.y}
                  width={Math.abs(br.x - tl.x)}
                  height={Math.abs(br.y - tl.y)}
                  fill={patternUrl}
                  opacity="0.4"
                />
              );
            })}

            {/* Polygons - Enhanced styling */}
            {(cfg.polygons || []).map((poly, i) => {
              const pts = poly.vertices.map(idx => getPt(idx)).map(p => `${p.x},${p.y}`).join(' ');
              return (
                <polygon
                  key={`poly-${i}`}
                  points={pts}
                  fill={poly.fillColor || THEME.colors.fill}
                  stroke={poly.strokeColor || THEME.colors.stroke}
                  strokeWidth={poly.strokeWidth || 2.5}
                  strokeLinejoin="round"
                  className="drop-shadow-sm"
                />
              );
            })}

            {/* Segments - Thicker lines */}
            {(cfg.segments || []).map((seg, i) => {
              const p1 = getPt(seg.from);
              const p2 = getPt(seg.to);
              return (
                <line
                  key={`seg-${i}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={seg.strokeColor || THEME.colors.text}
                  strokeWidth={seg.strokeWidth || 2.5}
                  strokeDasharray={seg.dash ? `${seg.dash * 8},${seg.dash * 4}` : undefined}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Circles */}
            {(cfg.circles || []).map((circ, i) => {
              const c = getPt(circ.center);
              return (
                <circle
                  key={`circ-${i}`}
                  cx={c.x}
                  cy={c.y}
                  r={circ.radius * scale}
                  fill={circ.fillColor || 'white'}
                  stroke={circ.strokeColor || THEME.colors.stroke}
                  strokeWidth="2.5"
                />
              );
            })}

            {/* Arcs */}
            {(cfg.arcs || []).map((arc, i) => {
              const c = getPt(arc.center);
              const from = getPt(arc.from);
              const to = getPt(arc.to);
              const r = Math.sqrt(Math.pow(from.x - c.x, 2) + Math.pow(from.y - c.y, 2));

              const startAngle = Math.atan2(from.y - c.y, from.x - c.x);
              const endAngle = Math.atan2(to.y - c.y, to.x - c.x);

              // Ensure we draw the smaller arc usually
              const largeArcFlag = 0;
              const sweepFlag = 0;

              const d = `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${to.x} ${to.y}`;

              return (
                <path
                  key={`arc-${i}`}
                  d={d}
                  stroke={arc.strokeColor || THEME.colors.secondary}
                  strokeWidth={arc.strokeWidth || 2}
                  fill="none"
                  markerEnd={arc.strokeColor === THEME.colors.secondary ? "url(#arrowhead-red)" : undefined}
                />
              );
            })}

            {/* Springs - Improved ZigZag */}
            {(cfg.springs || []).map((spring, i) => {
              const p1 = getPt(spring.from);
              const p2 = getPt(spring.to);
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const coils = spring.coils || 10;
              const width = 8; // Amplitude of spring

              let path = `M ${p1.x} ${p1.y}`;
              const nx = dx / dist;
              const ny = dy / dist;
              const px = -ny * width;
              const py = nx * width;

              for (let j = 0; j <= coils * 2; j++) {
                const t = j / (coils * 2);
                const x = p1.x + dx * t;
                const y = p1.y + dy * t;

                if (j === 0 || j === coils * 2) {
                  path += ` L ${x} ${y}`;
                } else {
                  // Alternating offset
                  const dir = j % 2 === 0 ? 0 : (j % 4 === 1 ? 1 : -1);
                  path += ` L ${x + px * dir} ${y + py * dir}`;
                }
              }

              return (
                <path
                  key={`spring-${i}`}
                  d={path}
                  stroke={THEME.colors.text}
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Arrows - Vectors */}
            {(cfg.arrows || []).map((arrow, i) => {
              const p1 = getPt(arrow.from);
              const p2 = getPt(arrow.to);
              const color = arrow.color || THEME.colors.primary;
              let markerId = 'url(#arrowhead-blue)';
              if (color === THEME.colors.secondary) markerId = 'url(#arrowhead-red)';
              if (color === THEME.colors.text) markerId = 'url(#arrowhead-text)';

              return (
                <g key={`arrow-${i}`}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={color}
                    strokeWidth="3"
                    markerEnd={markerId}
                  />
                </g>
              );
            })}

            {/* Points - Larger and more visible */}
            {(cfg.points || []).map((p, i) => {
              if (p.visible === false) return null;
              const pt = toSVG(p.x, p.y);
              return (
                <circle
                  key={`pt-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill={THEME.colors.text}
                  stroke="white"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        )}

        {/* HTML Overlay for Text/Math - Improved positioning and rendering */}
        <div className="absolute inset-0 pointer-events-none">
          {(cfg.labels || []).map((label, i) => {
            const pos = toSVG(label.x, label.y);
            return (
              <div
                key={`lbl-${i}`}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, -50%)',
                  color: label.color || THEME.colors.text,
                  textShadow: '0 1px 2px rgba(255,255,255,0.8), 0 0 4px white'
                }}
                className={`${THEME.fonts.math} text-base sm:text-lg font-medium z-10`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <span className="whitespace-nowrap">{children}</span>
                  }}
                >
                  {formatMath(label.text)}
                </ReactMarkdown>
              </div>
            );
          })}

          {(cfg.arrows || []).map((arrow, i) => {
            if (!arrow.label) return null;
            const p1 = getPt(arrow.from);
            const p2 = getPt(arrow.to);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <div
                key={`arrow-lbl-${i}`}
                style={{
                  position: 'absolute',
                  left: midX,
                  top: midY,
                  transform: 'translate(-50%, -100%) translateY(-10px)',
                  color: arrow.color || THEME.colors.primary,
                  textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                }}
                className={`${THEME.fonts.math} text-sm sm:text-base font-bold z-10`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <span className="whitespace-nowrap">{children}</span>
                  }}
                >
                  {formatMath(arrow.label)}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
