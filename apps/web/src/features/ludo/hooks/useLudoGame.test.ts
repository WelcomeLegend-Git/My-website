import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as engine from "../game/engine";
import type { GameSetup } from "../game/types";
import { useLudoGame } from "./useLudoGame";


const setup = (mode: GameSetup["mode"] = "single", seconds = 30): GameSetup => ({
  id: "same-id", mode, rules: { turnDurationSeconds: seconds },
  players: [
    { id: "r", name: "Red", color: "red", isBot: false, connection: "ready" },
    { id: "b", name: "Blue", color: "blue", isBot: false, connection: "ready" },
  ],
});
const mountedRoots = new Set<() => void>();
const mount = () => {
  const result = { current: undefined as unknown as ReturnType<typeof useLudoGame> };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const Harness = () => { result.current = useLudoGame(); return null; };
  act(() => root.render(createElement(StrictMode, null, createElement(Harness))));
  const unmount = () => {
    act(() => root.unmount());
    container.remove();
    mountedRoots.delete(unmount);
  };
  mountedRoots.add(unmount);
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
  mountedRoots.forEach((unmount) => unmount());
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useLudoGame lifecycle and command serialization", () => {
  it("serializes duplicate rolls and moves under StrictMode without nested updates", () => {

    const error = vi.spyOn(console, "error");
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => { result.current.roll(); result.current.roll(); });
    expect(result.current.isDiceRolling).toBe(true);
    advance(559);
    expect(result.current.game?.diceValue).toBeNull();
    advance(1);
    expect(engine.rollLocalDice).toHaveBeenCalledTimes(1);
    expect(result.current.game?.phase).toBe("moving");
    act(() => { result.current.move(0); result.current.move(0); });
    expect(result.current.game?.tokens.red).toEqual([0, -1, -1, -1]);
    expect(result.current.lastMoveResult?.state).toBe(result.current.game);
    expect(error).not.toHaveBeenCalled();
  });

  it("ignores invalid move clicks without throwing", () => {
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    advance(560);
    const before = result.current.game;
    act(() => { result.current.move(-1); result.current.move(4); result.current.move(NaN); });
    expect(result.current.game).toBe(before);
    expect(result.current.lastMoveResult).toBeNull();
  });

  it.each(["restart", "start"] as const)("invalidates a pending roll on %s even with matching id and revision", (command) => {
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    advance(200);
    act(() => command === "restart" ? result.current.restart() : result.current.start(setup()));
    act(() => result.current.roll());
    advance(360); // old roll would fire now
    expect(result.current.game?.diceValue).toBeNull();
    expect(result.current.isDiceRolling).toBe(true);
    expect(engine.rollLocalDice).not.toHaveBeenCalled();
    advance(200);
    expect(engine.rollLocalDice).toHaveBeenCalledTimes(1);
    expect(result.current.game?.diceValue).toBe(6);
  });

  it("cancels a pending roll before a manual turn change", () => {
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    advance(200);
    act(() => result.current.skipTurn());
    advance(360);
    expect(result.current.game?.activePlayerIndex).toBe(1);
    expect(result.current.game?.diceValue).toBeNull();
    expect(result.current.isDiceRolling).toBe(false);
    expect(engine.rollLocalDice).not.toHaveBeenCalled();
  });

  it("expires a turn during animation and does not roll for the next player", () => {
    const { result } = mount();
    act(() => result.current.start(setup("single", 0.4)));
    act(() => result.current.roll());
    advance(500);
    expect(result.current.game?.activePlayerIndex).toBe(1);
    advance(60);
    expect(result.current.isDiceRolling).toBe(false);
    expect(result.current.game?.diceValue).toBeNull();
    expect(engine.rollLocalDice).not.toHaveBeenCalled();
    expect(result.current.game?.moveLog.at(-1)?.kind).toBe("timeout");
  });

  it("checks deadlines at roll completion even before the next clock tick", () => {
    const { result } = mount();
    act(() => result.current.start(setup("single", 0.55)));
    act(() => result.current.roll());
    advance(560);
    expect(result.current.game?.activePlayerIndex).toBe(1);
    expect(result.current.game?.diceValue).toBeNull();
    expect(result.current.game?.moveLog.at(-1)?.kind).toBe("timeout");
  });

  it("clears move effects on restart and snapshots setup against caller mutation", () => {
    const { result } = mount();
    const options = setup();
    act(() => result.current.start(options));
    options.players[0].name = "changed";
    options.rules!.turnDurationSeconds = 99;
    act(() => result.current.roll());
    advance(560);
    act(() => result.current.move(0));
    expect(result.current.lastMoveResult).not.toBeNull();
    act(() => result.current.restart());
    expect(result.current.lastMoveResult).toBeNull();
    expect(result.current.game?.players[0].name).toBe("Red");
    expect(result.current.game?.rules.turnDurationSeconds).toBe(30);
    expect(result.current.game?.tokens.red).toEqual([-1, -1, -1, -1]);
  });

  it("a rejected setup leaves the current match and pending roll intact", () => {
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    const before = result.current.game;
    expect(() => act(() => result.current.start({ ...setup(), players: [] }))).toThrow();
    expect(result.current.game).toBe(before);
    advance(560);
    expect(result.current.game?.phase).toBe("moving");
  });

  it("leave clears pending rolls, move results and restart setup", () => {
    const { result } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    advance(560);
    act(() => result.current.move(0));
    act(() => result.current.roll());
    act(() => result.current.leave());
    advance(1_000);
    act(() => result.current.restart());
    expect(result.current.game).toBeNull();
    expect(result.current.lastMoveResult).toBeNull();
    expect(result.current.isDiceRolling).toBe(false);
    expect(result.current.handoffPlayerName).toBeNull();
    expect(engine.rollLocalDice).toHaveBeenCalledTimes(1);
  });

  it("unmount clears all timers and retained commands become harmless", () => {
    const { result, unmount } = mount();
    act(() => result.current.start(setup()));
    act(() => result.current.roll());
    const controller = result.current;
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { controller.roll(); controller.restart(); controller.start(setup()); });
    advance(10_000);
    expect(engine.rollLocalDice).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("pass-device deadlines", () => {
  it("pauses indefinitely and grants a full deadline on dismissal", () => {
    vi.mocked(engine.rollLocalDice).mockReturnValue(1);
    const { result } = mount();
    act(() => result.current.start(setup("pass", 1)));
    act(() => result.current.roll());
    advance(560);
    expect(result.current.handoffPlayerName).toBe("Blue");
    const waiting = result.current.game;
    act(() => { result.current.roll(); result.current.skipTurn(); result.current.move(0); });
    advance(5_000);
    expect(result.current.game).toBe(waiting);
    act(() => result.current.dismissHandoff());
    expect(result.current.handoffPlayerName).toBeNull();
    expect(result.current.game?.activePlayerIndex).toBe(1);
    expect(result.current.game?.turnStartedAt).toBe(Date.now());
    expect(result.current.game?.turnEndsAt).toBe(Date.now() + 1_000);
    const deadline = result.current.game?.turnEndsAt;
    act(() => result.current.dismissHandoff());
    expect(result.current.game?.turnEndsAt).toBe(deadline);
    advance(999);
    expect(result.current.game?.activePlayerIndex).toBe(1);
    advance(251);
    expect(result.current.handoffPlayerName).toBe("Red");
    expect(result.current.game?.activePlayerIndex).toBe(0);
  });

  it("does not show a handoff for a six bonus turn", () => {
    const { result } = mount();
    act(() => result.current.start(setup("pass")));
    act(() => result.current.roll());
    advance(560);
    act(() => result.current.move(0));
    expect(result.current.handoffPlayerName).toBeNull();
    expect(result.current.game?.activePlayerIndex).toBe(0);
  });
});

describe("bot scheduling", () => {
  const bots = () => {
    const options = setup();
    options.players[0].isBot = true;
    return options;
  };
  it("runs bot roll and move once and resets a pending bot move on restart", () => {
    const { result } = mount();
    act(() => result.current.start(bots()));
    advance(720);
    expect(result.current.isDiceRolling).toBe(true);
    advance(560);
    expect(result.current.game?.phase).toBe("moving");
    advance(580);
    expect(result.current.game?.tokens.red.filter((position) => position === 0)).toHaveLength(1);
    expect(engine.rollLocalDice).toHaveBeenCalledTimes(1);
    advance(720);
    advance(560);
    act(() => result.current.restart());
    advance(580);
    expect(result.current.game?.tokens.red).toEqual([-1, -1, -1, -1]);
    expect(result.current.game?.diceValue).toBeNull();
    expect(result.current.lastMoveResult).toBeNull();
  });

  it("cancels bot timers on unmount", () => {
    const { result, unmount } = mount();
    act(() => result.current.start(bots()));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(2_000);
    expect(engine.rollLocalDice).not.toHaveBeenCalled();
  });
});
