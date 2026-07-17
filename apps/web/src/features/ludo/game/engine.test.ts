import { describe, expect, it } from "vitest";

import {
  chooseBotMove,
  createGame,
  getLegalTokenIndexes,
  moveToken,
  rollDice,
  START_RING_INDEX,
} from "./engine";
import type { LudoPlayer } from "./types";

const players: LudoPlayer[] = [
  { id: "red", name: "Riya", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "Bunty Bot", color: "blue", isBot: true, connection: "bot" },
];

const game = () => createGame({ id: "test", mode: "single", players, now: 1_000 });

describe("Ludo engine", () => {
  it("requires a six to leave home and gives an extra turn", () => {
    const state = game();
    expect(rollDice(state, 4, 2_000).activePlayerIndex).toBe(1);

    const rolled = rollDice(state, 6, 2_000);
    expect(rolled.legalTokenIndexes).toEqual([0, 1, 2, 3]);

    const moved = moveToken(rolled, 0, 2_100).state;
    expect(moved.tokens.red[0]).toBe(0);
    expect(moved.activePlayerIndex).toBe(0);
    expect(moved.phase).toBe("rolling");
  });

  it("captures an opponent on an unsafe square", () => {
    const state = game();
    state.tokens.red[0] = 4;
    state.tokens.blue[0] = (5 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.captured).toEqual([{ color: "blue", tokenIndex: 0 }]);
    expect(moved.state.tokens.blue[0]).toBe(-1);
    expect(moved.extraTurn).toBe(true);
  });

  it("does not capture tokens on safe squares", () => {
    const state = game();
    state.tokens.red[0] = 7;
    state.tokens.blue[0] = (8 + START_RING_INDEX.red - START_RING_INDEX.blue + 52) % 52;

    const rolled = rollDice(state, 1, 2_000);
    const moved = moveToken(rolled, 0, 2_100);
    expect(moved.captured).toEqual([]);
    expect(moved.state.tokens.blue[0]).not.toBe(-1);
  });

  it("requires an exact roll to finish", () => {
    const state = game();
    state.tokens.red[0] = 56;

    expect(getLegalTokenIndexes({ ...state, diceValue: 2 })).not.toContain(0);
    const rolled = rollDice(state, 1, 2_000);
    expect(moveToken(rolled, 0, 2_100).state.tokens.red[0]).toBe(57);
  });

  it("cancels a third consecutive six", () => {
    let state = game();
    state = moveToken(rollDice(state, 6, 2_000), 0, 2_100).state;
    state = moveToken(rollDice(state, 6, 2_200), 0, 2_300).state;
    const third = rollDice(state, 6, 2_400);

    expect(third.activePlayerIndex).toBe(1);
    expect(third.phase).toBe("rolling");
    expect(third.tokens.red[0]).toBe(6);
  });

  it("lets a bot prefer finishing a token", () => {
    const state = game();
    state.players[0] = { ...state.players[0], isBot: true, connection: "bot" };
    state.tokens.red[0] = 56;
    state.tokens.red[1] = 12;
    const rolled = rollDice(state, 1, 2_000);

    expect(chooseBotMove(rolled)).toBe(0);
  });
});
