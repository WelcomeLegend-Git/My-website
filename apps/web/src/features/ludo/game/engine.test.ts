import { describe, expect, it } from "vitest";

import {
  chooseBotMove,
  createGame,
  getBlockadeRingIndexes,
  getLegalTokenIndexes,
  getRingIndex,
  isGameFinished,
  isPlayerFinished,
  moveToken,
  rollDice,
  forfeitTurn,
  advanceTurn,
  START_RING_INDEX,
} from "./engine";
import type { LudoPlayer, LudoGameState, LudoRules } from "./types";
import { FINISH_POSITION, HOME_POSITION } from "./types";

/* ---------- helpers ---------- */

const twoPlayers: LudoPlayer[] = [
  { id: "red", name: "Riya", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "Bunty Bot", color: "blue", isBot: true, connection: "bot" },
];

const fourPlayers: LudoPlayer[] = [
  { id: "red", name: "Riya", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "Bunty", color: "blue", isBot: false, connection: "ready" },
  { id: "yellow", name: "Yuki", color: "yellow", isBot: false, connection: "ready" },
  { id: "green", name: "Giri", color: "green", isBot: false, connection: "ready" },
];

const freshGame = (players = twoPlayers, rules?: Partial<LudoRules>): LudoGameState =>
  createGame({ id: "test", mode: "single", players, now: 1_000, rules });

/** Immutable helper: return a new state with a specific token position set. */
const withToken = (state: LudoGameState, color: keyof LudoGameState["tokens"], index: number, position: number): LudoGameState => ({
  ...state,
  tokens: {
    ...state.tokens,
    [color]: state.tokens[color].map((pos, i) => (i === index ? position : pos)),
  },
});

/* ================================================================
 *  ORIGINAL TESTS (rewritten without direct state mutation)
 * ================================================================ */

describe("Ludo engine — basics", () => {
  it("requires a six to leave home and gives an extra turn", () => {
    const state = freshGame();
    // A non-six keeps tokens locked and passes turn
    expect(rollDice(state, 4, 2_000).activePlayerIndex).toBe(1);

    // A six unlocks all four tokens
    const rolled = rollDice(state, 6, 2_000);
    expect(rolled.legalTokenIndexes).toEqual([0, 1, 2, 3]);

    // After moving out, player gets an extra turn (rolled a 6)
    const moved = moveToken(rolled, 0, 2_100).state;
    expect(moved.tokens.red[0]).toBe(0);
    expect(moved.activePlayerIndex).toBe(0);
    expect(moved.phase).toBe("rolling");
  });

  it("captures an opponent on an unsafe square", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 4);
    const blueRelativePos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelativePos);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.captured).toEqual([{ color: "blue", tokenIndex: 0 }]);
    expect(moved.state.tokens.blue[0]).toBe(HOME_POSITION);
    expect(moved.extraTurn).toBe(true);
  });

  it("does not capture tokens on safe squares", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 7);
    const blueRelativePos = (8 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelativePos);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.captured).toEqual([]);
    expect(moved.state.tokens.blue[0]).not.toBe(HOME_POSITION);
  });

  it("requires an exact roll to finish", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 56);
    expect(getLegalTokenIndexes({ ...state, diceValue: 2 })).not.toContain(0);

    const rolled = rollDice(state, 1, 2_000);
    expect(moveToken(rolled, 0, 2_100).state.tokens.red[0]).toBe(FINISH_POSITION);
  });

  it("cancels a third consecutive six", () => {
    let state = freshGame();
    state = moveToken(rollDice(state, 6, 2_000), 0, 2_100).state;
    state = moveToken(rollDice(state, 6, 2_200), 0, 2_300).state;
    const third = rollDice(state, 6, 2_400);

    expect(third.activePlayerIndex).toBe(1);
    expect(third.phase).toBe("rolling");
    // Token should not have moved from position 6 (two sixes from position 0)
    expect(third.tokens.red[0]).toBe(6);
  });

  it("lets a bot prefer finishing a token", () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p) =>
        p.color === "red" ? { ...p, isBot: true, connection: "bot" as const } : p,
      ),
    };
    state = withToken(state, "red", 0, 56);
    state = withToken(state, "red", 1, 12);
    const rolled = rollDice(state, 1, 2_000);
    expect(chooseBotMove(rolled)).toBe(0);
  });
});

/* ================================================================
 *  BLOCKADE TESTS (was missing — C3)
 * ================================================================ */

describe("Ludo engine — blockades", () => {
  it("detects a same-colour blockade (2 tokens of one colour on same ring square)", () => {
    let state = freshGame();
    // Place two red tokens on position 4 (ring index 4)
    state = withToken(state, "red", 0, 4);
    state = withToken(state, "red", 1, 4);
    const blockades = getBlockadeRingIndexes(state);
    const redRingIndex = getRingIndex("red", 4);
    expect(blockades).toContain(redRingIndex);
  });

  it("does NOT detect a cross-colour pair as a blockade", () => {
    let state = freshGame();
    // Place red on position 4 and blue on an equivalent ring position
    state = withToken(state, "red", 0, 4);
    const blueRelativePos = (4 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelativePos);
    const blockades = getBlockadeRingIndexes(state);
    // If only one token per colour is on that ring square, no blockade
    const redRingIndex = getRingIndex("red", 4);
    expect(blockades).not.toContain(redRingIndex);
  });

  it("allows a player to cross their own blockade", () => {
    let state = freshGame();
    // Create red blockade at position 3: two red tokens at position 3
    state = withToken(state, "red", 0, 2);
    state = withToken(state, "red", 1, 3);
    state = withToken(state, "red", 2, 3);
    // Token 0 at position 2 should be able to move through position 3 (own blockade)
    const rolled = rollDice(state, 3, 2_000);
    expect(rolled.legalTokenIndexes).toContain(0);
  });

  it("blocks a player from crossing an opponent blockade", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 2);
    // Place two blue tokens forming a blockade on the path from red position 2→8
    // Blue position that maps to red's ring index 5
    const blueRelPos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);
    state = withToken(state, "blue", 1, blueRelPos);
    // Red at position 2 rolling a 6 should try to cross ring index 5 (opponent blockade)
    const rolled = rollDice(state, 6, 2_000);
    expect(rolled.legalTokenIndexes).not.toContain(0);
  });

  it("blocks landing on an opponent blockade", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 1);
    // Blue blockade at ring index that red position 3 maps to
    const blueRelPos = (3 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);
    state = withToken(state, "blue", 1, blueRelPos);
    const rolled = rollDice(state, 2, 2_000);
    // Token 0 cannot land on the opponent blockade
    expect(rolled.legalTokenIndexes).not.toContain(0);
  });

  it("allows landing on a single opponent token (capture, not blockade)", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 1);
    // Only ONE blue token at the destination — no blockade, capture possible
    const blueRelPos = (3 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);
    const rolled = rollDice(state, 2, 2_000);
    expect(rolled.legalTokenIndexes).toContain(0);
  });

  it("disables blockades when rules say so", () => {
    let state = freshGame(twoPlayers, { blockadesEnabled: false });
    state = withToken(state, "red", 0, 2);
    const blueRelPos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);
    state = withToken(state, "blue", 1, blueRelPos);
    const rolled = rollDice(state, 6, 2_000);
    expect(rolled.legalTokenIndexes).toContain(0);
  });
});

/* ================================================================
 *  RANKED FINISH & GAME FINISH
 * ================================================================ */

describe("Ludo engine — finish & ranking", () => {
  it("awards rank to a player when all four tokens reach FINISH_POSITION", () => {
    let state = freshGame();
    // Place 3 red tokens at finish and 1 at position 56 (one away)
    state = withToken(state, "red", 0, FINISH_POSITION);
    state = withToken(state, "red", 1, FINISH_POSITION);
    state = withToken(state, "red", 2, FINISH_POSITION);
    state = withToken(state, "red", 3, 56);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 3, 2_100);
    expect(moved.finishedToken).toBe(true);
    expect(moved.state.winnerOrder).toContain("red");
  });

  it("isPlayerFinished correctly identifies finished players", () => {
    let state = freshGame();
    expect(isPlayerFinished(state, "red")).toBe(false);

    state = withToken(state, "red", 0, FINISH_POSITION);
    state = withToken(state, "red", 1, FINISH_POSITION);
    state = withToken(state, "red", 2, FINISH_POSITION);
    state = withToken(state, "red", 3, FINISH_POSITION);
    expect(isPlayerFinished(state, "red")).toBe(true);
  });

  it("isGameFinished returns true when only one player is left", () => {
    let state = freshGame();
    state = { ...state, winnerOrder: ["red"] };
    // Only blue is left in a 2-player game => game over
    expect(isGameFinished(state)).toBe(true);
  });

  it("isGameFinished returns false with two or more players remaining", () => {
    const state = freshGame(fourPlayers);
    expect(isGameFinished(state)).toBe(false);

    const state2 = { ...state, winnerOrder: ["red" as const] };
    expect(isGameFinished(state2)).toBe(false); // 3 still playing
  });

  it("ends game and transitions to finished phase", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, FINISH_POSITION);
    state = withToken(state, "red", 1, FINISH_POSITION);
    state = withToken(state, "red", 2, FINISH_POSITION);
    state = withToken(state, "red", 3, 56);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 3, 2_100);
    expect(moved.state.phase).toBe("finished");
    expect(moved.state.winnerOrder[0]).toBe("red");
  });

  it("grants extra turn on finishing a token (not the last one)", () => {
    let state = freshGame();
    state = withToken(state, "red", 0, 56);
    state = withToken(state, "red", 1, 10); // Not all at finish

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.finishedToken).toBe(true);
    expect(moved.extraTurn).toBe(true);
    expect(moved.state.activePlayerIndex).toBe(0);
  });
});

/* ================================================================
 *  TURN TIMEOUT & FORFEIT
 * ================================================================ */

describe("Ludo engine — timeout & forfeit", () => {
  it("forfeitTurn advances to next player", () => {
    const state = freshGame();
    const forfeited = forfeitTurn(state, 2_000, "manual");
    expect(forfeited.activePlayerIndex).toBe(1);
    expect(forfeited.phase).toBe("rolling");
  });

  it("forfeitTurn with timeout logs the timeout", () => {
    const state = freshGame();
    const forfeited = forfeitTurn(state, 2_000, "timeout");
    const lastLog = forfeited.moveLog[forfeited.moveLog.length - 1];
    expect(lastLog.kind).toBe("timeout");
    expect(lastLog.text).toContain("timed out");
  });

  it("forfeitTurn does nothing when game is already finished", () => {
    let state = freshGame();
    state = { ...state, phase: "finished" as const };
    const result = forfeitTurn(state, 2_000);
    expect(result.phase).toBe("finished");
  });

  it("advanceTurn cycles correctly in a 4-player game", () => {
    let state = freshGame(fourPlayers);
    expect(state.activePlayerIndex).toBe(0);

    state = advanceTurn(state, 2_000, "manual");
    expect(state.activePlayerIndex).toBe(1);

    state = advanceTurn(state, 3_000, "manual");
    expect(state.activePlayerIndex).toBe(2);

    state = advanceTurn(state, 4_000, "manual");
    expect(state.activePlayerIndex).toBe(3);

    state = advanceTurn(state, 5_000, "manual");
    expect(state.activePlayerIndex).toBe(0); // wraps around
  });

  it("advanceTurn skips players who have finished", () => {
    let state = freshGame(fourPlayers);
    state = { ...state, winnerOrder: ["blue"] };
    // Active is red (0), next should skip blue (1) and go to yellow (2)
    const advanced = advanceTurn(state, 2_000, "manual");
    expect(advanced.activePlayerIndex).toBe(2);
  });
});

/* ================================================================
 *  GAME CREATION VALIDATION
 * ================================================================ */

describe("Ludo engine — createGame", () => {
  it("throws when fewer than 2 players", () => {
    expect(() => createGame({ mode: "single", players: [twoPlayers[0]] })).toThrow("between two and four");
  });

  it("throws when duplicate colours", () => {
    expect(() =>
      createGame({
        mode: "pass",
        players: [
          { id: "a", name: "A", color: "red", isBot: false, connection: "ready" },
          { id: "b", name: "B", color: "red", isBot: false, connection: "ready" },
        ],
      }),
    ).toThrow("different colour");
  });

  it("creates a valid initial state", () => {
    const state = freshGame();
    expect(state.phase).toBe("rolling");
    expect(state.activePlayerIndex).toBe(0);
    expect(state.tokens.red.every((pos) => pos === HOME_POSITION)).toBe(true);
    expect(state.diceValue).toBeNull();
    expect(state.winnerOrder).toEqual([]);
    expect(state.revision).toBe(0);
  });

  it("normalizes bot connection status", () => {
    const state = freshGame();
    const bot = state.players.find((p) => p.isBot);
    expect(bot?.connection).toBe("bot");
  });
});

/* ================================================================
 *  MOVE LOG LIMIT
 * ================================================================ */

describe("Ludo engine — move log limit", () => {
  it("uses the configured moveLogLimit", () => {
    let state = freshGame(twoPlayers, { moveLogLimit: 4 });
    // Do several rolls to generate log entries
    for (let i = 0; i < 10; i += 1) {
      state = rollDice(state, 4, 3_000 + i * 100); // Non-six, no legal move, turn passes
    }
    expect(state.moveLog.length).toBeLessThanOrEqual(4);
  });

  it("defaults to 64 entries", () => {
    const state = freshGame();
    expect(state.rules.moveLogLimit).toBe(64);
  });
});

/* ================================================================
 *  BOT LOGIC
 * ================================================================ */

describe("Ludo engine — bot heuristics", () => {
  it("returns null when no legal moves", () => {
    const state = freshGame();
    expect(chooseBotMove(state)).toBeNull(); // no dice rolled
  });

  it("prefers capturing over normal advancement", () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p) =>
        p.color === "red" ? { ...p, isBot: true, connection: "bot" as const } : p,
      ),
    };
    state = withToken(state, "red", 0, 4);
    state = withToken(state, "red", 1, 10);
    // Place blue on position that red token 0 can capture with roll of 1
    const blueRelPos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);

    const rolled = rollDice(state, 1, 2_000);
    expect(chooseBotMove(rolled)).toBe(0); // Capture is higher priority
  });

  it("prefers leaving home when rolling a 6", () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p) =>
        p.color === "red" ? { ...p, isBot: true, connection: "bot" as const } : p,
      ),
    };
    state = withToken(state, "red", 0, HOME_POSITION);
    state = withToken(state, "red", 1, 3);
    const rolled = rollDice(state, 6, 2_000);
    // Bot should weigh leaving home positively
    const choice = chooseBotMove(rolled);
    expect(choice).not.toBeNull();
  });
});

/* ================================================================
 *  EDGE CASES
 * ================================================================ */

describe("Ludo engine — edge cases", () => {
  it("handles auto-skip when no legal moves exist (non-six, all at home)", () => {
    const state = freshGame();
    const rolled = rollDice(state, 3, 2_000);
    // No legal moves, turn should auto-advance to next player
    expect(rolled.activePlayerIndex).toBe(1);
    expect(rolled.phase).toBe("rolling");
  });

  it("capture grants extra turn when rule is enabled", () => {
    let state = freshGame(twoPlayers, { captureGrantsExtraTurn: true });
    state = withToken(state, "red", 0, 4);
    const blueRelPos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.extraTurn).toBe(true);
    expect(moved.state.activePlayerIndex).toBe(0);
  });

  it("capture does NOT grant extra turn when rule is disabled", () => {
    let state = freshGame(twoPlayers, { captureGrantsExtraTurn: false });
    state = withToken(state, "red", 0, 4);
    const blueRelPos = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;
    state = withToken(state, "blue", 0, blueRelPos);

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.captured.length).toBeGreaterThan(0);
    expect(moved.extraTurn).toBe(false);
    expect(moved.state.activePlayerIndex).toBe(1);
  });

  it("rolling when not in rolling phase throws LudoRuleError", () => {
    let state = freshGame();
    state = { ...state, phase: "moving" as const, diceValue: 6, legalTokenIndexes: [0] };
    expect(() => rollDice(state, 3, 2_000)).toThrow("finish their move");
  });

  it("moving an illegal token throws LudoRuleError", () => {
    const state = freshGame();
    const rolled = rollDice(state, 6, 2_000);
    // All tokens are legal (all at home, roll is 6), so let's make a moving state and try an out-of-range token
    const movingState = { ...rolled, legalTokenIndexes: [0, 1] };
    expect(() => moveToken(movingState, 3, 2_100)).toThrow("cannot use this dice roll");
  });

  it("revision increments with each state change", () => {
    let state = freshGame();
    const r0 = state.revision;
    state = rollDice(state, 6, 2_000);
    expect(state.revision).toBeGreaterThan(r0);
    const r1 = state.revision;
    state = moveToken(state, 0, 2_100).state;
    expect(state.revision).toBeGreaterThan(r1);
  });
});
