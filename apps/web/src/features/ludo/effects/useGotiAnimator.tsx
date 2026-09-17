import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FINISH_POSITION,
  HOME_POSITION,
  type LudoGameState,
  type PlayerColor,
  type TokenPosition,
} from "../game/types";
import {
  COLOR_META,
  FINISH_SLOTS,
  getTokenPoint,
  HOME_SLOTS,
  stackOffset,
  tokensAtPoint,
  type BoardPoint,
} from "../game/board";
import "./gotiAnimation.css";

export const HOP_DURATION_MS = 140;
export const YARD_HOP_DURATION_MS = 220;
export const CAPTURE_FLIGHT_DURATION_MS = 650;
export const CELEBRATION_DURATION_MS = 1200;

/**
 * Calculates every intermediate cell along the path from `from` to `to`.
 * - Yard (-1) -> Start square (0)
 * - Ring positions: (e.g. 10 -> 11 -> 12 -> 13)
 * - Ring -> Home lane (50 -> 51 -> 52 -> 53)
 * - Home lane -> Finish (55 -> 56)
 */
export function calculateGotiPath(from: TokenPosition, to: TokenPosition): TokenPosition[] {
  if (from === to) return [from];

  if (from === HOME_POSITION) {
    // Yard to start square (0), and forward if to > 0
    const path: TokenPosition[] = [HOME_POSITION, 0];
    for (let pos = 1; pos <= to; pos++) {
      path.push(pos);
    }
    return path;
  }

  if (to > from) {
    const path: TokenPosition[] = [];
    for (let pos = from; pos <= to; pos++) {
      path.push(pos);
    }
    return path;
  }

  // Fallback for unexpected reverse positions (e.g. direct yard return)
  return [from, to];
}

export interface GotiWaypoint {
  position: TokenPosition;
  x: number;
  y: number;
}

/**
 * Resolves each position along the path to pixel coordinates on the SVG board.
 */
export function getGotiPathWaypoints(
  color: PlayerColor,
  tokenIndex: number,
  path: TokenPosition[],
  unit: number,
  finalOffset: BoardPoint = { x: 0, y: 0 },
  startOffset: BoardPoint = { x: 0, y: 0 },
): GotiWaypoint[] {
  return path.map((position, index) => {
    const pt = getTokenPoint(color, position, tokenIndex);
    let ox = 0;
    let oy = 0;
    if (index === 0) {
      ox = startOffset.x;
      oy = startOffset.y;
    } else if (index === path.length - 1) {
      ox = finalOffset.x;
      oy = finalOffset.y;
    }

    return {
      position,
      x: (pt.x + 0.5 + ox) * unit,
      y: (pt.y + 0.5 + oy) * unit,
    };
  });
}

export interface AnimationKeyframes {
  x: number[];
  y: number[];
  scale: number[];
  scaleX: number[];
  scaleY: number[];
  rotate?: number[];
  times: number[];
  duration: number;
}

/**
 * Builds sequential parabolic hop keyframes with elevation arcs and squash-and-stretch.
 */
export function buildHopKeyframes(
  waypoints: GotiWaypoint[],
  hopDurationMs = HOP_DURATION_MS,
  yardDurationMs = YARD_HOP_DURATION_MS,
): AnimationKeyframes {
  if (waypoints.length <= 1) {
    const pt = waypoints[0] ?? { x: 0, y: 0 };
    return {
      x: [pt.x],
      y: [pt.y],
      scale: [1],
      scaleX: [1],
      scaleY: [1],
      times: [1],
      duration: 0,
    };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];
  const scaleXs: number[] = [];
  const scaleYs: number[] = [];
  const times: number[] = [];

  const hopCount = waypoints.length - 1;
  const durations: number[] = [];
  for (let i = 0; i < hopCount; i++) {
    const isYardHop = waypoints[i].position === HOME_POSITION;
    durations.push(isYardHop ? yardDurationMs : hopDurationMs);
  }
  const totalDurationMs = durations.reduce((acc, d) => acc + d, 0);

  let accumulatedMs = 0;

  for (let i = 0; i < hopCount; i++) {
    const w0 = waypoints[i];
    const w1 = waypoints[i + 1];
    const d = durations[i];
    const isYardHop = w0.position === HOME_POSITION;
    const apexLift = isYardHop ? 26 : 16; // Elevation lift in pixels (negative Y in SVG)

    // Sub-steps within this hop:
    // 0: Takeoff (squash preparation)
    // 1: Apex (elevated high in air, stretched along vertical)
    // 2: Landing impact (squash on ground)
    // 3: Rebound settle
    const subSteps = [
      { u: 0.0, lift: 0, s: 1.0, sx: 1.12, sy: 0.88 },
      { u: 0.5, lift: apexLift, s: 1.22, sx: 0.94, sy: 1.12 },
      { u: 0.88, lift: 0, s: 1.0, sx: 1.15, sy: 0.85 },
      { u: 1.0, lift: 0, s: 1.0, sx: 1.0, sy: 1.0 },
    ];

    // For i > 0, skip the first point if it duplicates the previous landing point
    const startIndex = i === 0 ? 0 : 1;

    for (let s = startIndex; s < subSteps.length; s++) {
      const step = subSteps[s];
      const stepMs = accumulatedMs + step.u * d;
      const t = Math.min(Math.max(stepMs / totalDurationMs, 0), 1);

      const interpX = w0.x + (w1.x - w0.x) * step.u;
      const interpY = w0.y + (w1.y - w0.y) * step.u - step.lift;

      xs.push(interpX);
      ys.push(interpY);
      scales.push(step.s);
      scaleXs.push(step.sx);
      scaleYs.push(step.sy);
      times.push(t);
    }

    accumulatedMs += d;
  }

  // Ensure last time is exactly 1
  if (times.length > 0) {
    times[times.length - 1] = 1;
  }

  return {
    x: xs,
    y: ys,
    scale: scales,
    scaleX: scaleXs,
    scaleY: scaleYs,
    times,
    duration: totalDurationMs / 1000,
  };
}

/**
 * Builds a capture flight trajectory:
 * High parabolic flight arc curving back to yard socket, spinning tumble, and scaling into dish.
 */
export function buildCaptureFlightKeyframes(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  durationMs = CAPTURE_FLIGHT_DURATION_MS,
): AnimationKeyframes {
  const samples = 10;
  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];
  const scaleXs: number[] = [];
  const scaleYs: number[] = [];
  const rotates: number[] = [];
  const times: number[] = [];

  // Apex elevated high above the board
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = Math.min(startPoint.y, endPoint.y) - 75;

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;

    // Quadratic Bezier interpolation
    const bx = (1 - u) * (1 - u) * startPoint.x + 2 * (1 - u) * u * midX + u * u * endPoint.x;
    const by = (1 - u) * (1 - u) * startPoint.y + 2 * (1 - u) * u * midY + u * u * endPoint.y;

    // Scale curve: rises high to 1.38, scales down into dish (0.75), rebounds to 1.0
    let s = 1.0;
    if (u < 0.5) {
      s = 1.0 + u * 2 * 0.38; // 1.0 -> 1.38
    } else if (u < 0.9) {
      const v = (u - 0.5) / 0.4;
      s = 1.38 - v * (1.38 - 0.75); // 1.38 -> 0.75
    } else {
      const v = (u - 0.9) / 0.1;
      s = 0.75 + v * 0.25; // 0.75 -> 1.0
    }

    // Tumble rotation: spins 720 degrees
    const r = u * 720;

    xs.push(bx);
    ys.push(by);
    scales.push(s);
    scaleXs.push(s);
    scaleYs.push(s);
    rotates.push(r);
    times.push(u);
  }

  return {
    x: xs,
    y: ys,
    scale: scales,
    scaleX: scaleXs,
    scaleY: scaleYs,
    rotate: rotates,
    times,
    duration: durationMs / 1000,
  };
}

export interface CelebrationState {
  id: string;
  color: PlayerColor;
  point: BoardPoint;
  timestamp: number;
}

export interface TokenAnimationProps {
  x: number | number[];
  y: number | number[];
  scale?: number | number[];
  scaleX?: number | number[];
  scaleY?: number | number[];
  rotate?: number | number[];
  transition: Record<string, unknown>;
  isAnimating: boolean;
  isCapturedFlight: boolean;
}

export interface UseGotiAnimatorOptions {
  state: LudoGameState;
  unit?: number;
  reducedMotion?: boolean;
  onCelebration?: (color: PlayerColor, tokenIndex: number, point: BoardPoint) => void;
}

interface ActiveTokenHop {
  color: PlayerColor;
  tokenIndex: number;
  keyframes: AnimationKeyframes;
  finishScalePop: boolean;
  finished: boolean;
}

interface ActiveCapturedFlight {
  color: PlayerColor;
  tokenIndex: number;
  delayMs: number;
  keyframes: AnimationKeyframes;
  holdingPoint: { x: number; y: number };
}

export const useGotiAnimator = ({
  state,
  unit = 40,
  reducedMotion = false,
  onCelebration,
}: UseGotiAnimatorOptions) => {
  const [activeHop, setActiveHop] = useState<ActiveTokenHop | null>(null);
  const [activeCaptures, setActiveCaptures] = useState<ActiveCapturedFlight[]>([]);
  const [inFlightCaptureKeys, setInFlightCaptureKeys] = useState<Set<string>>(() => new Set());
  const [celebrations, setCelebrations] = useState<CelebrationState[]>([]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const processedMoveKeyRef = useRef<string | null>(null);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Clean up old celebrations after CELEBRATION_DURATION_MS
  useEffect(() => {
    if (celebrations.length === 0) return;
    const now = Date.now();
    const active = celebrations.filter((c) => now - c.timestamp < CELEBRATION_DURATION_MS);
    if (active.length !== celebrations.length) {
      setCelebrations(active);
    }
  }, [celebrations]);

  // Detect and orchestrate new moves
  useEffect(() => {
    const lastMove = state.lastMove;
    if (!lastMove || reducedMotion) {
      setActiveHop(null);
      setActiveCaptures([]);
      setInFlightCaptureKeys(new Set());
      return;
    }

    const moveKey = `${lastMove.playerColor}-${lastMove.tokenIndex}-${lastMove.from}->${lastMove.to}-${lastMove.captured
      .map((c) => `${c.color}${c.tokenIndex}`)
      .join(",")}-${state.turnStartedAt}-${state.revision}`;

    if (processedMoveKeyRef.current === moveKey) {
      return;
    }
    processedMoveKeyRef.current = moveKey;

    clearAllTimers();

    // 1. Calculate path and waypoints for the moving token
    const path = calculateGotiPath(lastMove.from, lastMove.to);
    if (path.length <= 1) {
      setActiveHop(null);
      return;
    }

    const stack =
      lastMove.to >= 0 && lastMove.to !== FINISH_POSITION
        ? tokensAtPoint(state, lastMove.playerColor, lastMove.to)
        : [];
    const stackIdx = stack.findIndex(
      (t) => t.color === lastMove.playerColor && t.tokenIndex === lastMove.tokenIndex,
    );
    const finalOffset = stackOffset(stackIdx >= 0 ? stackIdx : 0, stack.length);

    const waypoints = getGotiPathWaypoints(
      lastMove.playerColor,
      lastMove.tokenIndex,
      path,
      unit,
      finalOffset,
    );
    const hopKeyframes = buildHopKeyframes(waypoints);

    const isFinishing = lastMove.finished || lastMove.to === FINISH_POSITION;

    const newHop: ActiveTokenHop = {
      color: lastMove.playerColor,
      tokenIndex: lastMove.tokenIndex,
      keyframes: hopKeyframes,
      finishScalePop: isFinishing,
      finished: isFinishing,
    };
    setActiveHop(newHop);

    const hopDurationMs = hopKeyframes.duration * 1000;

    // 2. Handle captured tokens (if any)
    if (lastMove.captured.length > 0) {
      const captureArrivalPt = getTokenPoint(
        lastMove.playerColor,
        lastMove.to,
        lastMove.tokenIndex,
      );
      const holdingX = (captureArrivalPt.x + 0.5) * unit;
      const holdingY = (captureArrivalPt.y + 0.5) * unit;

      const plannedCaptures: ActiveCapturedFlight[] = lastMove.captured.map((c) => {
        const yardPt = HOME_SLOTS[c.color][c.tokenIndex];
        const endX = (yardPt.x + 0.5) * unit;
        const endY = (yardPt.y + 0.5) * unit;
        const flightKeyframes = buildCaptureFlightKeyframes(
          { x: holdingX, y: holdingY },
          { x: endX, y: endY },
        );

        return {
          color: c.color,
          tokenIndex: c.tokenIndex,
          delayMs: Math.max(hopDurationMs - 60, 0),
          keyframes: flightKeyframes,
          holdingPoint: { x: holdingX, y: holdingY },
        };
      });

      setActiveCaptures(plannedCaptures);

      // Start flight for each captured goti once the attacking token strikes
      plannedCaptures.forEach((cap) => {
        const t = setTimeout(() => {
          setInFlightCaptureKeys((prev) => {
            const next = new Set(prev);
            next.add(`${cap.color}-${cap.tokenIndex}`);
            return next;
          });
        }, cap.delayMs);
        timersRef.current.push(t);

        // Complete capture flight
        const tComplete = setTimeout(() => {
          setActiveCaptures((prev) =>
            prev.filter((c) => !(c.color === cap.color && c.tokenIndex === cap.tokenIndex)),
          );
          setInFlightCaptureKeys((prev) => {
            const next = new Set(prev);
            next.delete(`${cap.color}-${cap.tokenIndex}`);
            return next;
          });
        }, cap.delayMs + CAPTURE_FLIGHT_DURATION_MS);
        timersRef.current.push(tComplete);
      });
    } else {
      setActiveCaptures([]);
      setInFlightCaptureKeys(new Set());
    }

    // 3. Handle finish celebrations
    if (isFinishing) {
      const finishTimer = setTimeout(() => {
        const finishPoint = FINISH_SLOTS[lastMove.playerColor];
        const celebrationItem: CelebrationState = {
          id: `finish-${lastMove.playerColor}-${lastMove.tokenIndex}-${Date.now()}`,
          color: lastMove.playerColor,
          point: finishPoint,
          timestamp: Date.now(),
        };
        setCelebrations((prev) => [...prev, celebrationItem]);
        onCelebration?.(lastMove.playerColor, lastMove.tokenIndex, finishPoint);
      }, hopDurationMs);
      timersRef.current.push(finishTimer);
    }

    // 4. Complete hopping animation
    const hopTimer = setTimeout(() => {
      setActiveHop(null);
    }, hopDurationMs + (isFinishing ? 300 : 50));
    timersRef.current.push(hopTimer);
  }, [state, unit, reducedMotion, onCelebration, clearAllTimers]);

  /**
   * Helper to retrieve animation props for a specific token.
   */
  const getTokenAnimationProps = useCallback(
    (
      color: PlayerColor,
      tokenIndex: number,
      restX: number,
      restY: number,
      selectable: boolean,
    ): TokenAnimationProps => {
      if (reducedMotion) {
        return {
          x: restX,
          y: restY,
          scale: 1,
          transition: { duration: 0 },
          isAnimating: false,
          isCapturedFlight: false,
        };
      }

      // Check if this token is currently in captured flight
      const capturedFlight = activeCaptures.find(
        (c) => c.color === color && c.tokenIndex === tokenIndex,
      );
      if (capturedFlight) {
        const isFlying = inFlightCaptureKeys.has(`${color}-${tokenIndex}`);
        if (isFlying) {
          const kf = capturedFlight.keyframes;
          return {
            x: kf.x,
            y: kf.y,
            scale: kf.scale,
            scaleX: kf.scaleX,
            scaleY: kf.scaleY,
            rotate: kf.rotate,
            transition: {
              duration: kf.duration,
              times: kf.times,
              ease: "easeInOut",
            },
            isAnimating: true,
            isCapturedFlight: true,
          };
        }
        // Still waiting at the capture square for the attacking goti to strike
        return {
          x: capturedFlight.holdingPoint.x,
          y: capturedFlight.holdingPoint.y,
          scale: 1,
          transition: { duration: 0 },
          isAnimating: true,
          isCapturedFlight: false,
        };
      }

      // Check if this token is currently hopping
      if (activeHop && activeHop.color === color && activeHop.tokenIndex === tokenIndex) {
        const kf = activeHop.keyframes;
        return {
          x: kf.x,
          y: kf.y,
          scale: activeHop.finishScalePop ? [...kf.scale, 1.4, 0.95, 1.1, 1.0] : kf.scale,
          scaleX: kf.scaleX,
          scaleY: kf.scaleY,
          transition: {
            duration: kf.duration,
            times: kf.times,
            ease: "linear",
          },
          isAnimating: true,
          isCapturedFlight: false,
        };
      }

      // Static resting token
      return {
        x: restX,
        y: restY,
        scale: selectable ? [1, 1.09, 1] : 1,
        transition: {
          x: { type: "spring", stiffness: 190, damping: 18, mass: 0.65 },
          y: { type: "spring", stiffness: 190, damping: 18, mass: 0.65 },
          scale: selectable
            ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.18 },
        },
        isAnimating: false,
        isCapturedFlight: false,
      };
    },
    [activeHop, activeCaptures, inFlightCaptureKeys, reducedMotion],
  );

  return useMemo(
    () => ({
      getTokenAnimationProps,
      celebrations,
      isAnyAnimating: activeHop !== null || activeCaptures.length > 0,
    }),
    [getTokenAnimationProps, celebrations, activeHop, activeCaptures.length],
  );
};

export interface GotiCelebrationBurstProps {
  cx: number;
  cy: number;
  color: PlayerColor;
  boardId: string;
}

/**
 * SVG Celebration Effect:
 * Radial golden sparkle burst + expanding shockwave ring around home triangle entry.
 */
export const GotiCelebrationBurst = ({
  cx,
  cy,
  color,
  boardId,
}: GotiCelebrationBurstProps) => {
  const meta = COLOR_META[color];
  const sparkles = useMemo(() => {
    const items = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 42;
      items.push({
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        size: i % 2 === 0 ? 5 : 3.5,
      });
    }
    return items;
  }, []);

  return (
    <g
      className="goti-celebration-group"
      transform={`translate(${cx}, ${cy})`}
      aria-hidden="true"
    >
      {/* Outer golden glow shockwave */}
      <circle
        className="goti-finish-shockwave"
        r="10"
        fill="none"
        stroke="#f59e0b"
        filter={`url(#${boardId}-glow)`}
      />
      {/* Inner color-themed shockwave */}
      <circle
        className="goti-finish-shockwave"
        r="10"
        fill="none"
        stroke={meta.color}
        strokeWidth="2.5"
      />
      {/* Golden halo burst */}
      <circle
        className="goti-finish-halo"
        r="12"
        fill="#fef08a"
        opacity="0.8"
        filter={`url(#${boardId}-glow)`}
      />
      {/* 8 Radial Sparkle Stars / Diamonds */}
      {sparkles.map((sp, idx) => (
        <g
          key={idx}
          className="goti-sparkle-star"
          style={
            {
              "--sparkle-dx": `${sp.dx}px`,
              "--sparkle-dy": `${sp.dy}px`,
            } as React.CSSProperties
          }
        >
          <polygon
            points={`0,-${sp.size} ${sp.size * 0.4},0 0,${sp.size} -${sp.size * 0.4},0`}
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        </g>
      ))}
    </g>
  );
};
