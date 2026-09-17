// @vitest-environment jsdom
import { act, createElement, StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as engine from "../game/engine";
import type { GameSetup } from "../game/types";
import { useLudoGame } from "./useLudoGame";

const setup = (mode: GameSetup["mode"] = "single"): GameSetup => ({
  id: "reused-session-id", mode,
  players: [
    { id: "red", name: "Red", color: "red", isBot: false, connection: "ready" },
    { id: "blue", name: "Blue", color: "blue", isBot: false, connection: "ready" },
  ],
});
const cleanups = new Set<() => void>();
const mount = (autoStart = false) => {
  const result = { current: undefined as unknown as ReturnType<typeof useLudoGame> };
  const container = document.createElement("div");
  const root = createRoot(container);
  const Harness = () => {
    result.current = useLudoGame();
    const started = useRef(false);
    useEffect(() => {
      if (autoStart && !started.current) {
        started.current = true;
        result.current.start(setup());
      }
    }, []);
    return null;
  };
  act(() => root.render(createElement(StrictMode, null, createElement(Harness))));
  const unmount = () => {
    act(() => root.unmount());
    cleanups.delete(unmount);
  };
  cleanups.add(unmount);
  return { result, unmount };
};
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  vi.spyOn(engine, "rollLocalDice").mockReturnValue(6);
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("local session and turn timer races", () => {
  it("retains restart setup across StrictMode effect cleanup and replay", () => {
    const { result } = mount(true);
    act(() => result.current.skipTurn());
    expect(result.current.game?.activePlayerIndex).toBe(1);
    act(() => result.current.restart());
    expect(result.current.game?.activePlayerIndex).toBe(0);
    expect(result.current.game?.revision).toBe(0);
  });

  it.each(["restart", "turn", "handoff", "leave", "unmount"] as const)(
    "ignores an already queued dice callback after %s",
    (boundary) => {
      const { result, unmount } = mount();
      act(() => result.current.start(setup(boundary === "handoff" ? "pass" : "single")));
      const timers = vi.spyOn(window, "setTimeout");
      act(() => result.current.roll());
      const callback = timers.mock.calls.find(([, delay]) => delay === 560)?.[0];
      expect(callback).toBeTypeOf("function");
      advance(200);
      act(() => {
        if (boundary === "restart") result.current.restart();
        else if (boundary === "leave") result.current.leave();
        else if (boundary !== "unmount") result.current.skipTurn();
      });
      if (boundary === "unmount") unmount();
      if (boundary === "handoff") {
        advance(60_000);
        expect(result.current.handoffPlayerName).toBe("Blue");
        act(() => result.current.dismissHandoff());
      }
      if (boundary !== "leave" && boundary !== "unmount") {
        act(() => result.current.roll());
      }
      const before = result.current.game;
      // Simulate a callback already queued by the browser despite cancellation.
      act(() => (callback as () => void)());
      expect(result.current.game).toBe(before);
      expect(engine.rollLocalDice).not.toHaveBeenCalled();
      if (boundary !== "leave" && boundary !== "unmount") {
        advance(560);
        expect(engine.rollLocalDice).toHaveBeenCalledTimes(1);
        expect(result.current.game?.phase).toBe("moving");
      }
    },
  );

  it("resets handoff, deadline and transient state on restart", () => {
    const { result } = mount();
    act(() => result.current.start(setup("pass")));
    act(() => result.current.roll());
    advance(560);
    act(() => result.current.move(0));
    act(() => result.current.skipTurn());
    advance(60_000);
    expect(result.current.handoffPlayerName).toBe("Blue");
    act(() => result.current.restart());
    expect(result.current).toMatchObject({
      isDiceRolling: false, handoffPlayerName: null, lastMoveResult: null,
      game: { activePlayerIndex: 0, revision: 0, phase: "rolling", diceValue: null,
        legalTokenIndexes: [], consecutiveSixes: 0, winnerOrder: [], lastMove: null,
        turnStartedAt: Date.now(), turnEndsAt: Date.now() + 30_000 },
    });
    expect(result.current.game?.tokens.red).toEqual([-1, -1, -1, -1]);
    expect(result.current.game?.moveLog).toHaveLength(1);
  });
});
