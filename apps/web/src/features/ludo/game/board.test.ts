import { describe, expect, it } from "vitest";

import {
  COLOR_META,
  getTokenPoint,
  HOME_LANE_CELLS,
  RING_CELLS,
  stackOffset,
  tokensAtPoint,
} from "./board";
import { createGame, getRingIndex, HOME_LANE_START, RING_LENGTH } from "./engine";
import { FINISH_POSITION, HOME_POSITION, PLAYER_COLORS, type LudoPlayer } from "./types";

const players: LudoPlayer[] = [
  { id: "red", name: "R", color: "red", isBot: false, connection: "ready" },
  { id: "blue", name: "B", color: "blue", isBot: false, connection: "ready" },
];

const game = () => createGame({ id: "test", mode: "pass", players, now: 1_000 });

describe("Board coordinate mapping", () => {
  it("RING_CELLS has exactly 52 entries", () => {
    expect(RING_CELLS.length).toBe(RING_LENGTH);
  });

  it("each HOME_LANE has exactly 5 cells", () => {
    for (const color of PLAYER_COLORS) {
      expect(HOME_LANE_CELLS[color].length).toBe(5);
    }
  });

  it("COLOR_META has entries for all 4 colours", () => {
    for (const color of PLAYER_COLORS) {
      expect(COLOR_META[color]).toBeDefined();
      expect(COLOR_META[color].label).toBeTruthy();
      expect(COLOR_META[color].color).toBeTruthy();
    }
  });

  it("getTokenPoint returns home slot for HOME_POSITION", () => {
    const point = getTokenPoint("red", HOME_POSITION, 0);
    expect(point.x).toBeGreaterThan(0);
    expect(point.y).toBeGreaterThan(0);
  });

  it("getTokenPoint returns finish slot for FINISH_POSITION", () => {
    const point = getTokenPoint("red", FINISH_POSITION, 0);
    expect(point.x).toBeGreaterThan(0);
    expect(point.y).toBeGreaterThan(0);
  });

  it("getTokenPoint returns ring cell for ring positions", () => {
    const point = getTokenPoint("red", 5, 0);
    const ringIndex = getRingIndex("red", 5)!;
    expect(point).toEqual(RING_CELLS[ringIndex]);
  });

  it("getTokenPoint returns home lane cell for home lane positions", () => {
    const point = getTokenPoint("red", HOME_LANE_START, 0);
    expect(point).toEqual(HOME_LANE_CELLS.red[0]);
  });

  it("different home token indexes map to different slots", () => {
    const p0 = getTokenPoint("red", HOME_POSITION, 0);
    const p1 = getTokenPoint("red", HOME_POSITION, 1);
    expect(p0.x !== p1.x || p0.y !== p1.y).toBe(true);
  });
});

describe("tokensAtPoint", () => {
  it("returns empty for HOME_POSITION", () => {
    const state = game();
    expect(tokensAtPoint(state, "red", HOME_POSITION)).toEqual([]);
  });

  it("returns empty for FINISH_POSITION", () => {
    const state = game();
    expect(tokensAtPoint(state, "red", FINISH_POSITION)).toEqual([]);
  });

  it("finds tokens on the same ring square", () => {
    const state = game();
    // Both red token 0 and token 1 at position 5
    state.tokens.red[0] = 5;
    state.tokens.red[1] = 5;
    const result = tokensAtPoint(state, "red", 5);
    expect(result.length).toBe(2);
  });
});

describe("stackOffset", () => {
  it("returns zero offset for a single token", () => {
    const offset = stackOffset(0, 1);
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it("returns non-zero offsets for multiple tokens", () => {
    const offset = stackOffset(0, 2);
    expect(offset.x !== 0 || offset.y !== 0).toBe(true);
  });

  it("provides distinct offsets for different indexes in a stack", () => {
    const o0 = stackOffset(0, 4);
    const o1 = stackOffset(1, 4);
    const o2 = stackOffset(2, 4);
    const o3 = stackOffset(3, 4);
    const points = [o0, o1, o2, o3];
    const unique = new Set(points.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(4);
  });
});
