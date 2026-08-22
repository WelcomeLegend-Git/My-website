import { HOME_LANE_START, getRingIndex } from "./engine";
import { FINISH_POSITION, HOME_POSITION, type LudoGameState, type PlayerColor, type TokenPosition } from "./types";

export interface BoardPoint {
  x: number;
  y: number;
}

export const BOARD_UNITS = 15;
export const CELL_UNITS = 1;

// Clockwise path. Indexes 0, 13, 26 and 39 are the coloured starting squares.
export const RING_CELLS: BoardPoint[] = [
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
  { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 },
  { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 9, y: 6 }, { x: 10, y: 6 },
  { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 }, { x: 14, y: 7 },
  { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 },
  { x: 9, y: 8 }, { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 },
  { x: 8, y: 13 }, { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }, { x: 6, y: 13 },
  { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 }, { x: 5, y: 8 },
  { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  { x: 0, y: 7 }, { x: 0, y: 6 },
];

export const HOME_LANE_CELLS: Record<PlayerColor, BoardPoint[]> = {
  red: [
    { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
  ],
  blue: [
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 },
  ],
  yellow: [
    { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 },
  ],
  green: [
    { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 },
  ],
};

const HOME_SLOTS: Record<PlayerColor, BoardPoint[]> = {
  red: [
    { x: 2.2, y: 2.2 }, { x: 4.8, y: 2.2 }, { x: 2.2, y: 4.8 }, { x: 4.8, y: 4.8 },
  ],
  blue: [
    { x: 10.2, y: 2.2 }, { x: 12.8, y: 2.2 }, { x: 10.2, y: 4.8 }, { x: 12.8, y: 4.8 },
  ],
  yellow: [
    { x: 10.2, y: 10.2 }, { x: 12.8, y: 10.2 }, { x: 10.2, y: 12.8 }, { x: 12.8, y: 12.8 },
  ],
  green: [
    { x: 2.2, y: 10.2 }, { x: 4.8, y: 10.2 }, { x: 2.2, y: 12.8 }, { x: 4.8, y: 12.8 },
  ],
};

const FINISH_SLOTS: Record<PlayerColor, BoardPoint> = {
  red: { x: 6.35, y: 7.5 },
  blue: { x: 7.5, y: 6.35 },
  yellow: { x: 8.65, y: 7.5 },
  green: { x: 7.5, y: 8.65 },
};

export const COLOR_META: Record<PlayerColor, { label: string; color: string; deep: string; pale: string; symbol: string }> = {
  red: { label: "Ruby", color: "#ff4f70", deep: "#a91543", pale: "#ffdee5", symbol: "◆" },
  blue: { label: "Sapphire", color: "#3b9dff", deep: "#1264c5", pale: "#d9efff", symbol: "●" },
  yellow: { label: "Solar", color: "#f7c84b", deep: "#b77a05", pale: "#fff2bd", symbol: "✦" },
  green: { label: "Jade", color: "#32d39a", deep: "#0b9470", pale: "#d9fff1", symbol: "▲" },
};

export const getTokenPoint = (
  color: PlayerColor,
  position: TokenPosition,
  tokenIndex: number,
): BoardPoint => {
  if (position === HOME_POSITION) return HOME_SLOTS[color][tokenIndex];
  if (position === FINISH_POSITION) return FINISH_SLOTS[color];
  if (position >= HOME_LANE_START) return HOME_LANE_CELLS[color][position - HOME_LANE_START];

  const ringIndex = getRingIndex(color, position);
  return ringIndex === null ? HOME_SLOTS[color][tokenIndex] : RING_CELLS[ringIndex];
};

export const tokensAtPoint = (
  state: LudoGameState,
  color: PlayerColor,
  position: TokenPosition,
): Array<{ color: PlayerColor; tokenIndex: number }> => {
  // Home and finish tokens occupy private visual slots and cannot stack with others
  if (position === HOME_POSITION || position === FINISH_POSITION) return [];

  const target = getTokenPoint(color, position, 0);
  const tokens: Array<{ color: PlayerColor; tokenIndex: number }> = [];

  for (const candidateColor of Object.keys(state.tokens) as PlayerColor[]) {
    state.tokens[candidateColor].forEach((candidatePosition, tokenIndex) => {
      if (candidatePosition < 0 || candidatePosition === FINISH_POSITION) return;
      const candidate = getTokenPoint(candidateColor, candidatePosition, tokenIndex);
      if (candidate.x === target.x && candidate.y === target.y) tokens.push({ color: candidateColor, tokenIndex });
    });
  }

  return tokens;
};

export const stackOffset = (index: number, total: number): BoardPoint => {
  if (total <= 1) return { x: 0, y: 0 };
  const offsets = [
    { x: -0.16, y: -0.16 }, { x: 0.16, y: -0.16 }, { x: -0.16, y: 0.16 }, { x: 0.16, y: 0.16 },
  ];
  return offsets[index % offsets.length];
};
