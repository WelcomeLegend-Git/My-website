import { describe, expect, it, vi } from "vitest";
import { getTokenPoint, HOME_LANE_CELLS } from "./board";
import {
  advanceTurn, applyGameIntent, createGame, getBlockadeRingIndexes, getCaptures,
  getDestination, getLegalTokenIndexes, getRingIndex, HOME_LANE_START, moveToken, rollDice,
} from "./engine";
import { initialLocalController, reduceLocalController } from "./localController";
import { FINISH_POSITION, HOME_POSITION, PLAYER_COLORS, type LudoRules } from "./types";

const game = (rules: Partial<LudoRules> = {}) => createGame({
  id: "replay", mode: "pass", now: 1_000, rules: { blockadesEnabled: true, ...rules },
  players: PLAYER_COLORS.map((color) => ({ id: color, color, name: color, isBot: false, connection: "ready" })),
});

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

describe("standard zero-based path boundaries", () => {
  it.each(PLAYER_COLORS)("enters %s's private lane directly from its junction", (color) => {
    expect(HOME_LANE_START).toBe(51);
    expect(FINISH_POSITION).toBe(56);
    const junction = getTokenPoint(color, 50, 0);
    const first = getTokenPoint(color, 51, 0);
    expect(Math.abs(junction.x - first.x) + Math.abs(junction.y - first.y)).toBe(1);
    expect(getRingIndex(color, 50)).not.toBeNull();
    expect(getRingIndex(color, 51)).toBeNull();
    for (let position = 0; position < FINISH_POSITION; position += 1) {
      expect(getTokenPoint(color, position, 0)).toBeDefined();
      expect(getDestination(position, 1)).toBe(position + 1);
    }
    expect(getTokenPoint(color, 55, 0)).toEqual(HOME_LANE_CELLS[color][4]);
    expect(getDestination(50, 6)).toBe(FINISH_POSITION);
    expect(getDestination(51, 6)).toBeNull();
    expect(getDestination(FINISH_POSITION, 1)).toBeNull();
  });

  it("stops checking ring blockades after the home junction", () => {
    const state = game();
    state.tokens.red[0] = 49;
    state.tokens.blue = [37, 37, -1, -1]; // ring 50: the junction is still on the path
    expect(getLegalTokenIndexes(state, "red", 2)).not.toContain(0);
    state.tokens.blue = [38, 38, -1, -1]; // ring 51: bypassed when entering red's lane
    expect(getLegalTokenIndexes(state, "red", 2)).toContain(0);
    state.tokens.red[0] = 51;
    expect(getCaptures(state, "red", 52)).toEqual([]);
  });
});

describe("defensive engine inputs", () => {
  it.each([0, -1, 7, 1.5, NaN, Infinity, -Infinity])("rejects die %s consistently", (value) => {
    const state = game();
    expect(() => rollDice(state, value, 2_000)).toThrow();
    expect(getLegalTokenIndexes(state, "red", value)).toEqual([]);
    expect(getDestination(HOME_POSITION, value, false)).toBeNull();
    expect(getDestination(10, value)).toBeNull();
  });

  it.each([-2, 0.5, 57, NaN, Infinity])("rejects invalid progress %s", (position) => {
    expect(getDestination(position, 1)).toBeNull();
    expect(getRingIndex("red", position)).toBeNull();
  });

  it("revalidates cached legal moves against current tokens and rules", () => {
    const state = rollDice(game(), 6, 2_000);
    state.tokens.red[0] = FINISH_POSITION;
    expect(() => moveToken(state, 0, 2_100)).toThrow();
    for (const index of [-1, 4, 0.5, NaN]) expect(() => moveToken(state, index, 2_100)).toThrow();
    state.diceValue = 7;
    expect(() => moveToken(state, 1, 2_100)).toThrow();
  });

  it.each([-1, NaN, Infinity])("rejects invalid duration %s", (turnDurationSeconds) => {
    expect(() => game({ turnDurationSeconds })).toThrow();
  });
  it("supports turnDurationSeconds=0 for untimed play", () => {
    expect(game({ turnDurationSeconds: 0 }).turnEndsAt).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid log limit %s", (moveLogLimit) => {
    expect(() => game({ moveLogLimit })).toThrow();
  });
  it("keeps defaults when optional rules are undefined", () => {
    expect(game({ rankedFinish: undefined }).rules.rankedFinish).toBe(true);
    expect(game({ turnDurationSeconds: undefined }).turnEndsAt).toBe(31_000);
  });
});

describe("rule variants", () => {
  it.each([true, false])("honors rankedFinish=%s after first finisher", (rankedFinish) => {
    const state = game({ rankedFinish });
    state.tokens.red = [56, 56, 56, 55];
    const result = moveToken(rollDice(state, 1, 2_000), 3, 2_100);
    expect(result.state.winnerOrder).toEqual(["red"]);
    expect(result.state.phase).toBe(rankedFinish ? "rolling" : "finished");
    expect(result.extraTurn).toBe(false);
    if (rankedFinish) expect(result.state.activePlayerIndex).toBe(1);
    else expect(advanceTurn(result.state, 3_000)).toBe(result.state);
  });

  it("ends ranked play with one remaining player and skips previous finishers", () => {
    const state = game();
    state.winnerOrder = ["blue", "yellow"];
    state.tokens.red = [56, 56, 56, 55];
    const result = moveToken(rollDice(state, 1, 2_000), 3, 2_100);
    expect(result.state.phase).toBe("finished");
    expect(result.state.winnerOrder).toEqual(["blue", "yellow", "red"]);
  });

  it.each([true, false])("retains no-move sixes; threeSixesLoseTurn=%s", (threeSixesLoseTurn) => {
    let state = game({ threeSixesLoseTurn });
    state.tokens.red = [55, 56, 56, 56];
    state = rollDice(state, 6, 2_000);
    expect(state).toMatchObject({ activePlayerIndex: 0, phase: "rolling", diceValue: null,
      legalTokenIndexes: [], consecutiveSixes: 1, turnStartedAt: 2_000, turnEndsAt: 32_000 });
    state = rollDice(state, 6, 3_000);
    expect(state.consecutiveSixes).toBe(2);
    state = rollDice(state, 6, 4_000);
    expect(state.activePlayerIndex).toBe(threeSixesLoseTurn ? 1 : 0);
    expect(state.consecutiveSixes).toBe(threeSixesLoseTurn ? 0 : 3);
  });

  it("resets the six streak on a non-six without a legal move", () => {
    const state = game();
    state.tokens.red = [55, 56, 56, 56];
    const next = rollDice(rollDice(state, 6, 2_000), 2, 3_000);
    expect(next.activePlayerIndex).toBe(1);
    expect(next.consecutiveSixes).toBe(0);
  });

  it("allows any valid die to deploy when six-to-leave is disabled", () => {
    for (let value = 1; value <= 6; value += 1) {
      const result = moveToken(rollDice(game({ requireSixToLeaveHome: false }), value, 2_000), 0, 2_100);
      expect(result.state.tokens.red[0]).toBe(0);
      expect(result.extraTurn).toBe(value === 6);
    }
  });

  it("does not grant a finish bonus when disabled", () => {
    const state = game({ finishGrantsExtraTurn: false });
    state.tokens.red[0] = 55;
    const result = moveToken(rollDice(state, 1, 2_000), 0, 2_100);
    expect(result.finishedToken).toBe(true);
    expect(result.extraTurn).toBe(false);
    expect(result.state.activePlayerIndex).toBe(1);
  });

  it("disabled blockades allow passage and capture the entire unsafe stack", () => {
    const state = game({ blockadesEnabled: false });
    state.tokens.red[0] = 4;
    state.tokens.blue = [44, 44, -1, -1]; // ring 5
    expect(getBlockadeRingIndexes(state)).toEqual([]);
    expect(getLegalTokenIndexes(state, "red", 2)).toContain(0);
    const result = moveToken(rollDice(state, 1, 2_000), 0, 2_100);
    expect(result.captured).toEqual([{ color: "blue", tokenIndex: 0 }, { color: "blue", tokenIndex: 1 }]);
    expect(result.state.tokens.blue).toEqual([-1, -1, -1, -1]);
    expect(new Set(result.state.moveLog.map((entry) => entry.id)).size).toBe(result.state.moveLog.length);
  });

  it.each([true, false])("safe stacks cannot be captured with blockadesEnabled=%s", (blockadesEnabled) => {
    const state = game({ blockadesEnabled });
    state.tokens.red[0] = 7;
    state.tokens.blue = [47, 47, -1, -1]; // ring 8
    expect(getCaptures(state, "red", 8)).toEqual([]);
    expect(getLegalTokenIndexes(state, "red", 1).includes(0)).toBe(true);
  });
});

describe("pure deterministic transitions", () => {
  it("replays identical intents without sampling randomness or mutating inputs", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("unexpected entropy"); });
    try {
      const replay = () => {
        let state = freeze(game({ moveLogLimit: 3 }));
        for (let i = 0; i < 4; i += 1) {
          state = freeze(applyGameIntent(state, { type: "ROLL", value: 6, now: 2_000 }));
          if (state.phase === "moving") state = freeze(applyGameIntent(state, { type: "MOVE", tokenIndex: 0, now: 2_000 }));
        }
        return state;
      };
      expect(replay()).toEqual(replay());
      const state = replay();
      expect(state.moveLog).toHaveLength(3);
      expect(new Set(state.moveLog.map((entry) => entry.id)).size).toBe(3);
    } finally { random.mockRestore(); }
  });

  it("local transition replay is pure and invalid moves are harmless", () => {
    const state = freeze(reduceLocalController(initialLocalController(1_000), { type: "start", game: game(), now: 1_000 }));
    const rolling = freeze(reduceLocalController(state, { type: "roll-start", now: 1_100 }));
    const action = { type: "roll-end" as const, value: 6, now: 1_660 };
    const moving = freeze(reduceLocalController(rolling, action));
    expect(reduceLocalController(rolling, action)).toEqual(moving);
    expect(reduceLocalController(moving, { type: "move", tokenIndex: 100, now: 1_700 })).toBe(moving);
    const move = { type: "move" as const, tokenIndex: 0, now: 1_700 };
    expect(reduceLocalController(moving, move)).toEqual(reduceLocalController(moving, move));
  });
});
