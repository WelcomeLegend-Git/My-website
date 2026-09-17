import React from "react";
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  calculateGotiPath,
  getGotiPathWaypoints,
  buildHopKeyframes,
  buildCaptureFlightKeyframes,
  useGotiAnimator,
  GotiCelebrationBurst,
  HOP_DURATION_MS,
  YARD_HOP_DURATION_MS,
} from "./useGotiAnimator";
import { FINISH_POSITION, HOME_POSITION, type LudoGameState } from "../game/types";
import { getTokenPoint, HOME_SLOTS, RING_CELLS } from "../game/board";
import { createGame, moveToken, rollDice } from "../game/engine";

describe("calculateGotiPath", () => {
  it("calculates yard to start square (-1 to 0)", () => {
    const path = calculateGotiPath(HOME_POSITION, 0);
    expect(path).toEqual([-1, 0]);
  });

  it("calculates multi-step leap from yard if to > 0", () => {
    const path = calculateGotiPath(HOME_POSITION, 3);
    expect(path).toEqual([-1, 0, 1, 2, 3]);
  });

  it("calculates sequential ring positions (10 -> 14)", () => {
    const path = calculateGotiPath(10, 14);
    expect(path).toEqual([10, 11, 12, 13, 14]);
  });

  it("calculates ring to home lane transition (49 -> 53)", () => {
    const path = calculateGotiPath(49, 53);
    expect(path).toEqual([49, 50, 51, 52, 53]);
  });

  it("calculates home lane to finish (54 -> 56)", () => {
    const path = calculateGotiPath(54, FINISH_POSITION);
    expect(path).toEqual([54, 55, 56]);
  });

  it("returns single item when from === to", () => {
    expect(calculateGotiPath(12, 12)).toEqual([12]);
  });
});

describe("getGotiPathWaypoints", () => {
  const unit = 40;

  it("computes exact board coordinates for each cell along the path", () => {
    const path = [10, 11, 12];
    const waypoints = getGotiPathWaypoints("red", 0, path, unit);

    expect(waypoints).toHaveLength(3);
    path.forEach((pos, idx) => {
      const pt = getTokenPoint("red", pos, 0);
      expect(waypoints[idx].x).toBe((pt.x + 0.5) * unit);
      expect(waypoints[idx].y).toBe((pt.y + 0.5) * unit);
    });
  });

  it("applies start and final stack offsets to endpoints", () => {
    const path = [5, 6, 7];
    const startOffset = { x: 0.16, y: -0.16 };
    const finalOffset = { x: -0.16, y: 0.16 };
    const waypoints = getGotiPathWaypoints("blue", 1, path, unit, finalOffset, startOffset);

    const pt0 = getTokenPoint("blue", 5, 1);
    expect(waypoints[0].x).toBe((pt0.x + 0.5 + startOffset.x) * unit);
    expect(waypoints[0].y).toBe((pt0.y + 0.5 + startOffset.y) * unit);

    const pt2 = getTokenPoint("blue", 7, 1);
    expect(waypoints[2].x).toBe((pt2.x + 0.5 + finalOffset.x) * unit);
    expect(waypoints[2].y).toBe((pt2.y + 0.5 + finalOffset.y) * unit);
  });
});

describe("buildHopKeyframes", () => {
  it("returns instant static frame for single point", () => {
    const kf = buildHopKeyframes([{ position: 0, x: 100, y: 100 }]);
    expect(kf.duration).toBe(0);
    expect(kf.x).toEqual([100]);
  });

  it("creates sequential parabolic hop keyframes with elevation curve and squash-and-stretch", () => {
    const waypoints = [
      { position: 10, x: 100, y: 200 },
      { position: 11, x: 140, y: 200 },
      { position: 12, x: 180, y: 200 },
    ];

    const kf = buildHopKeyframes(waypoints, HOP_DURATION_MS);

    // 2 hops = 2 * 140ms = 280ms
    expect(kf.duration).toBeCloseTo(0.28, 2);

    // Check apex lift: at apex, y should be less than baseline 200 (elevated in SVG)
    expect(Math.min(...kf.y)).toBeLessThan(200);

    // Check squash and stretch:
    // Takeoff/landing squash: scaleX > 1, scaleY < 1
    const maxScaleX = Math.max(...kf.scaleX);
    const minScaleY = Math.min(...kf.scaleY);
    expect(maxScaleX).toBeGreaterThan(1.1);
    expect(minScaleY).toBeLessThan(0.9);

    // Apex stretch: scaleY > 1, scaleX < 1
    const minScaleX = Math.min(...kf.scaleX);
    const maxScaleY = Math.max(...kf.scaleY);
    expect(minScaleX).toBeLessThan(1.0);
    expect(maxScaleY).toBeGreaterThan(1.05);
  });

  it("uses higher apex and longer duration when leaving yard", () => {
    const waypoints = [
      { position: HOME_POSITION, x: 50, y: 200 },
      { position: 0, x: 100, y: 200 },
    ];

    const kf = buildHopKeyframes(waypoints, HOP_DURATION_MS, YARD_HOP_DURATION_MS);
    expect(kf.duration).toBeCloseTo(YARD_HOP_DURATION_MS / 1000, 2);

    // Apex lift for yard hop should be 26px
    const midY = 200;
    expect(Math.min(...kf.y)).toBe(midY - 26);
  });
});

describe("buildCaptureFlightKeyframes", () => {
  it("generates parabolic high arc, 720 degree tumble and socket scale-down", () => {
    const start = { x: 200, y: 300 };
    const end = { x: 60, y: 60 };
    const kf = buildCaptureFlightKeyframes(start, end, 650);

    expect(kf.duration).toBe(0.65);
    expect(kf.rotate).toBeDefined();

    // Rotates full 720 degrees
    expect(kf.rotate![0]).toBe(0);
    expect(kf.rotate![kf.rotate!.length - 1]).toBe(720);

    // Flies high into the air: apex Y should be significantly above min(start.y, end.y)
    const minY = Math.min(...kf.y);
    expect(minY).toBeLessThan(60);

    // Scales up in flight, then down into socket dish (0.75)
    expect(Math.max(...kf.scale)).toBeGreaterThan(1.3);
    expect(Math.min(...kf.scale)).toBeLessThanOrEqual(0.75);
  });
});

describe("useGotiAnimator hook", () => {
  const baseGame = () =>
    createGame({
      id: "anim-test",
      mode: "pass",
      now: 1000,
      players: [
        { id: "red", name: "Rhea", color: "red", isBot: false, connection: "ready" },
        { id: "blue", name: "Ben", color: "blue", isBot: false, connection: "ready" },
      ],
    });

  it("returns static spring props when there is no lastMove", () => {
    const state = baseGame();
    const { result } = renderHook(() => useGotiAnimator({ state }));

    const props = result.current.getTokenAnimationProps("red", 0, 100, 100, false);
    expect(props.x).toBe(100);
    expect(props.y).toBe(100);
    expect(props.isAnimating).toBe(false);
  });

  it("returns instant static coordinates without animation when reducedMotion is true", () => {
    const stateAfterRoll = rollDice(baseGame(), 6, 1100);
    const moved = moveToken(stateAfterRoll, 0, 1200);

    const { result } = renderHook(() =>
      useGotiAnimator({ state: moved.state, reducedMotion: true }),
    );

    const props = result.current.getTokenAnimationProps("red", 0, 100, 100, false);
    expect(props.isAnimating).toBe(false);
    expect(props.transition).toEqual({ duration: 0 });
  });

  it("builds multi-waypoint keyframes when a token moves", () => {
    const stateAfterRoll = rollDice(baseGame(), 6, 1100);
    const moved = moveToken(stateAfterRoll, 0, 1200);

    const { result } = renderHook(() => useGotiAnimator({ state: moved.state }));

    const props = result.current.getTokenAnimationProps("red", 0, 100, 100, false);
    expect(props.isAnimating).toBe(true);
    expect(Array.isArray(props.x)).toBe(true);
    expect(Array.isArray(props.y)).toBe(true);
    expect(props.transition).toHaveProperty("duration");
  });

  it("handles captured token in-flight status and coordinates", () => {
    const g = baseGame();
    const capturedState: LudoGameState = {
      ...g,
      lastMove: {
        playerColor: "red",
        tokenIndex: 0,
        from: 10,
        to: 14,
        captured: [{ color: "blue", tokenIndex: 0 }],
        finished: false,
        rolled: 4,
      },
    };

    const { result } = renderHook(() => useGotiAnimator({ state: capturedState }));

    // Red 0 is hopping
    const movingProps = result.current.getTokenAnimationProps("red", 0, 200, 200, false);
    expect(movingProps.isAnimating).toBe(true);

    // Blue 0 is in captured state waiting for strike
    const capturedProps = result.current.getTokenAnimationProps("blue", 0, 50, 50, false);
    expect(capturedProps.isAnimating).toBe(true);
  });

  it("triggers celebration when token finishes", () => {
    const g = baseGame();
    const celebrationSpy = vi.fn();
    vi.useFakeTimers();

    const finishedState: LudoGameState = {
      ...g,
      lastMove: {
        playerColor: "red",
        tokenIndex: 0,
        from: 55,
        to: FINISH_POSITION,
        captured: [],
        finished: true,
        rolled: 1,
      },
    };

    renderHook(() =>
      useGotiAnimator({
        state: finishedState,
        onCelebration: celebrationSpy,
      }),
    );

    // Advance past the hop duration (1 hop = 140ms)
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(celebrationSpy).toHaveBeenCalledWith("red", 0, expect.any(Object));
    vi.useRealTimers();
  });
});

describe("GotiCelebrationBurst", () => {
  it("renders SVG celebratory elements including shockwave, halo, and sparkles", () => {
    const { container } = render(
      <svg>
        <GotiCelebrationBurst cx={300} cy={300} color="red" boardId="test" />
      </svg>,
    );

    expect(container.querySelector(".goti-celebration-group")).toBeInTheDocument();
    expect(container.querySelectorAll(".goti-finish-shockwave").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".goti-sparkle-star")).toHaveLength(8);
  });
});
