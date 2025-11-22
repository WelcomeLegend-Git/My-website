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

const formatMath = (raw: unknown) => {
  // Allow either a plain string or an object like { text: "..." }
  let text = '';

  if (typeof raw === 'string') {
    text = raw;
  } else if (raw && typeof raw === 'object' && 'text' in (raw as any)) {
    text = String((raw as any).text ?? '');
  } else {
    return '';
  }

  const trimmed = text.trim();
  if (!trimmed) return '';

  const hasDelimiters =
    trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\)');
  const looksLikeMath = /\\[a-zA-Z]+|[=+\-^]/.test(trimmed);

  if (!hasDelimiters && looksLikeMath) {
    return `$${trimmed}$`;
  }

  return trimmed;
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
  const boundingBox = cfg.boundingBox || [-6, 4, 6, -4]; // [minX, maxY, maxX, minY]
  const [minX, maxY, maxX, minY] = boundingBox;

  // Coordinate transformation
  const toSVG = (x: number, y: number) => {
    const scaleX = dimensions.width / (maxX - minX);
    const scaleY = dimensions.height / (maxY - minY);
    return {
      x: (x - minX) * scaleX,
      y: (maxY - y) * scaleY,
    };
  };

  const scale = dimensions.width / (maxX - minX);
  const points = cfg.points || [];
  const getPt = (ref: any) => {
    if (!dimensions.width || !dimensions.height) {
      return { x: 0, y: 0 };
    }

    if (Array.isArray(ref) && ref.length >= 2) {
      const [x, y] = ref;
      if (typeof x === 'number' && typeof y === 'number') {
        return toSVG(x, y);
      }
    }

    if (typeof ref === 'string') {
      const named = points.find((p) => p.name === ref);
      if (named) {
        return toSVG(named.x, named.y);
      }
    }

    if (typeof ref === 'number' && ref >= 0 && ref < points.length) {
      const p = points[ref];
      if (p) {
        return toSVG(p.x, p.y);
      }
    }

    if (ref && typeof ref === 'object' && typeof ref.x === 'number' && typeof ref.y === 'number') {
      return toSVG(ref.x, ref.y);
    }

    return { x: dimensions.width / 2, y: dimensions.height / 2 };
  };

  if (!diagram) return null;

  return (
    <div className="space-y-3 font-sans">
      {(diagram.title || diagram.description) && (
        <div className="bg-blue-50/50 border-l-4 border-blue-600 p-3 rounded-r-lg">
          {diagram.title && <div className="font-bold text-blue-900 text-sm">{diagram.title}</div>}
          {diagram.description && <div className="text-blue-800/80 text-xs mt-0.5">{diagram.description}</div>}
        </div>
      )}

      <div

        ref={containerRef}
        className="relative w-full h-80 bg-white rounded-xl border border-slate-200 overflow-hidden select-none"
      >
        {dimensions.width > 0 && (
          <svg
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="block w-full h-full"
          >
            <defs>
              {/* Arrowhead Marker */}
              <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={THEME.colors.primary} />
              </marker>
              <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={THEME.colors.secondary} />
              </marker>

              {/* Ground Hatching Pattern */}
              <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke={THEME.colors.ground} strokeWidth="1" opacity="0.5" />
              </pattern>

              {/* Dot Pattern */}
              <pattern id="dot" patternUnits="userSpaceOnUse" width="10" height="10">
                <circle cx="5" cy="5" r="1" fill={THEME.colors.ground} />
              </pattern>

              {/* Cross Pattern */}
              <pattern id="cross" patternUnits="userSpaceOnUse" width="10" height="10">
                <path d="M2,2 L8,8 M8,2 L2,8" stroke={THEME.colors.ground} strokeWidth="1" />
              </pattern>
            </defs>

            {/* Grid/Axes */}
            {cfg.axes !== false && (
              <g className="axes">
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

              const tl = toSVG(rMinX, rMaxY); // Top-Left in SVG (max Y in math is min Y in SVG)
              const br = toSVG(rMaxX, rMinY); // Bottom-Right in SVG

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
                  opacity="0.6"
                />
              );
            })}

            {/* Polygons */}
            {(cfg.polygons || []).map((poly, i) => {
              const pts = poly.vertices.map(idx => getPt(idx)).map(p => `${p.x},${p.y}`).join(' ');
              return (
                <polygon
                  key={`poly-${i}`}
                  points={pts}
                  fill={poly.fillColor || THEME.colors.fill}
                  stroke={poly.strokeColor || THEME.colors.stroke}
                  strokeWidth={poly.strokeWidth || 2}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Segments */}
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
                  strokeWidth={seg.strokeWidth || 2}
                  strokeDasharray={seg.dash ? `${seg.dash * 5},${seg.dash * 3}` : undefined}
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
                  fill={circ.fillColor || 'none'}
                  stroke={circ.strokeColor || THEME.colors.secondary}
                  strokeWidth="2"
                />
              );
            })}

            {/* Arcs */}
            {(cfg.arcs || []).map((arc, i) => {
              const c = getPt(arc.center);
              const from = getPt(arc.from);
              const to = getPt(arc.to);
              const r = Math.sqrt(Math.pow(from.x - c.x, 2) + Math.pow(from.y - c.y, 2));

              // Calculate angles for SVG arc
              // Math coordinates: Y is up. SVG: Y is down.
              // We need to be careful.
              // Let's use the SVG coordinates directly.
              const startAngle = Math.atan2(from.y - c.y, from.x - c.x);
              const endAngle = Math.atan2(to.y - c.y, to.x - c.x);

              // SVG Arc flag logic
              // large-arc-flag: 1 if angle > 180
              // sweep-flag: 1 for clockwise, 0 for counter-clockwise
              // In SVG (Y down), clockwise is positive angle direction.

              // We want to go from 'from' to 'to'.
              // Let's assume counter-clockwise in math (standard), which is clockwise in SVG?
              // Wait, if Y is flipped, rotation direction flips too.
              // Math CCW = SVG CW.

              // Let's try sweep-flag 0 first.
              const largeArcFlag = 0; // Simplified, might need fix for >180
              const sweepFlag = 0;

              const d = `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${to.x} ${to.y}`;

              return (
                <path
                  key={`arc-${i}`}
                  d={d}
                  stroke={arc.strokeColor || THEME.colors.secondary}
                  strokeWidth={arc.strokeWidth || 2}
                  fill="none"
                />
              );
            })}

            {/* Springs */}
            {(cfg.springs || []).map((spring, i) => {
              const p1 = getPt(spring.from);
              const p2 = getPt(spring.to);
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const coils = spring.coils || 8;
              const width = 10;

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
                  const dir = j % 2 === 0 ? 0 : (j % 4 === 1 ? 1 : -1);
                  path += ` L ${x + px * dir} ${y + py * dir}`;
                }
              }

              return (
                <path
                  key={`spring-${i}`}
                  d={path}
                  stroke={THEME.colors.text}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Arrows */}
            {(cfg.arrows || []).map((arrow, i) => {
              const p1 = getPt(arrow.from);
              const p2 = getPt(arrow.to);
              const color = arrow.color || THEME.colors.primary;
              const markerId = color === THEME.colors.secondary ? 'url(#arrowhead-red)' : 'url(#arrowhead-blue)';

              return (
                <line
                  key={`arrow-${i}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth="2"
                  markerEnd={markerId}
                />
              );
            })}

            {/* Points */}
            {(cfg.points || []).map((p, i) => {
              if (p.visible === false) return null;
              const pt = toSVG(p.x, p.y);
              return (
                <circle
                  key={`pt-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={THEME.colors.text}
                />
              );
            })}
          </svg>
        )}

        {/* HTML Overlay for Text/Math */}
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
                }}
                className={`${THEME.fonts.math} text-sm sm:text-base drop-shadow-md`}
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
                  transform: 'translate(-50%, -100%) translateY(-8px)',
                  color: arrow.color || THEME.colors.primary,
                }}
                className={`${THEME.fonts.math} text-xs sm:text-sm font-bold drop-shadow-sm`}
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