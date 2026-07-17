import { motion } from "framer-motion";
import type { KeyboardEvent } from "react";

import { isSafeRingIndex } from "../game/engine";
import {
  BOARD_UNITS,
  COLOR_META,
  getTokenPoint,
  HOME_LANE_CELLS,
  RING_CELLS,
  stackOffset,
  tokensAtPoint,
} from "../game/board";
import { FINISH_POSITION, type LudoGameState, type PlayerColor } from "../game/types";

const SVG_SIZE = 600;
const UNIT = SVG_SIZE / BOARD_UNITS;

const colorAtStart: Record<number, PlayerColor> = {
  0: "red",
  13: "blue",
  26: "yellow",
  39: "green",
};

const yardShapes: Array<{ color: PlayerColor; x: number; y: number }> = [
  { color: "red", x: 0, y: 0 },
  { color: "blue", x: 9, y: 0 },
  { color: "yellow", x: 9, y: 9 },
  { color: "green", x: 0, y: 9 },
];

interface LudoBoardProps {
  state: LudoGameState;
  onTokenSelect: (tokenIndex: number) => void;
  interactionDisabled?: boolean;
}

const onTokenKeyDown = (event: KeyboardEvent<SVGGElement>, onSelect: () => void): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
};

export const LudoBoard = ({ state, onTokenSelect, interactionDisabled = false }: LudoBoardProps) => {
  const activePlayer = state.players[state.activePlayerIndex];

  return (
    <div className="ludo-board-shell" aria-label="Ludo game board">
      <div className="ludo-board-aura ludo-board-aura-one" aria-hidden="true" />
      <div className="ludo-board-aura ludo-board-aura-two" aria-hidden="true" />
      <svg className="ludo-board" viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} role="img" aria-labelledby="ludo-board-title ludo-board-description">
        <title id="ludo-board-title">A game of Ludo in progress</title>
        <desc id="ludo-board-description">Select one of your highlighted tokens after rolling the dice.</desc>
        <defs>
          <linearGradient id="board-base" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#0c1731" />
            <stop offset="0.52" stopColor="#14254b" />
            <stop offset="1" stopColor="#081226" />
          </linearGradient>
          <filter id="token-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#020617" floodOpacity="0.55" />
          </filter>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="board-grain" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="#d9efff" opacity="0.13" />
          </pattern>
        </defs>

        <rect x="3" y="3" width={SVG_SIZE - 6} height={SVG_SIZE - 6} rx="42" fill="url(#board-base)" stroke="#496489" strokeOpacity="0.58" strokeWidth="6" />
        <rect x="11" y="11" width={SVG_SIZE - 22} height={SVG_SIZE - 22} rx="35" fill="url(#board-grain)" opacity="0.36" />

        {yardShapes.map(({ color, x, y }) => {
          const meta = COLOR_META[color];
          return (
            <g key={color}>
              <rect
                x={x * UNIT + 15}
                y={y * UNIT + 15}
                width={6 * UNIT - 30}
                height={6 * UNIT - 30}
                rx="31"
                fill={meta.color}
                fillOpacity="0.16"
                stroke={meta.color}
                strokeOpacity="0.63"
                strokeWidth="3"
              />
              <rect
                x={(x + 0.65) * UNIT}
                y={(y + 0.65) * UNIT}
                width={4.7 * UNIT}
                height={4.7 * UNIT}
                rx="25"
                fill="#071226"
                fillOpacity="0.75"
                stroke={meta.color}
                strokeOpacity="0.23"
                strokeWidth="2"
              />
              <text x={(x + 3) * UNIT} y={(y + 1.2) * UNIT} textAnchor="middle" className="ludo-yard-label" fill={meta.color}>
                {meta.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {RING_CELLS.map((cell, index) => {
          const startColor = colorAtStart[index];
          const safe = isSafeRingIndex(index);
          const meta = startColor ? COLOR_META[startColor] : null;
          return (
            <g key={`ring-${index}`}>
              <rect
                x={cell.x * UNIT + 2}
                y={cell.y * UNIT + 2}
                width={UNIT - 4}
                height={UNIT - 4}
                rx="8"
                fill={meta?.color ?? "#e9f2ff"}
                fillOpacity={meta ? 0.91 : 0.9}
                stroke={meta?.deep ?? "#85a1c5"}
                strokeOpacity={meta ? 0.8 : 0.36}
                strokeWidth="2"
              />
              {safe && (
                <path
                  d={`M ${(cell.x + 0.5) * UNIT} ${(cell.y + 0.23) * UNIT} l 5 10 11 1 -8 7 3 11 -11 -6 -11 6 3 -11 -8 -7 11 -1 Z`}
                  fill={meta?.deep ?? "#7592bc"}
                  opacity="0.72"
                  transform={`scale(.7) translate(${((cell.x + 0.5) * UNIT) / 0.7 * 0.3}, ${((cell.y + 0.5) * UNIT) / 0.7 * 0.3})`}
                />
              )}
            </g>
          );
        })}

        {(Object.keys(HOME_LANE_CELLS) as PlayerColor[]).flatMap((color) =>
          HOME_LANE_CELLS[color].map((cell, index) => {
            const meta = COLOR_META[color];
            return (
              <rect
                key={`${color}-lane-${index}`}
                x={cell.x * UNIT + 2}
                y={cell.y * UNIT + 2}
                width={UNIT - 4}
                height={UNIT - 4}
                rx="8"
                fill={meta.color}
                fillOpacity={0.24 + index * 0.08}
                stroke={meta.color}
                strokeOpacity="0.72"
                strokeWidth="2"
              />
            );
          }),
        )}

        <g className="ludo-centre-star" aria-hidden="true">
          <path d="M300 300 L240 240 L300 240 Z" fill={COLOR_META.blue.color} fillOpacity="0.88" />
          <path d="M300 300 L360 240 L360 300 Z" fill={COLOR_META.yellow.color} fillOpacity="0.88" />
          <path d="M300 300 L360 360 L300 360 Z" fill={COLOR_META.green.color} fillOpacity="0.88" />
          <path d="M300 300 L240 360 L240 300 Z" fill={COLOR_META.red.color} fillOpacity="0.88" />
          <circle cx="300" cy="300" r="17" fill="#f8fbff" fillOpacity="0.95" />
          <path d="M300 287 L304 296 L314 296 L306 302 L309 312 L300 306 L291 312 L294 302 L286 296 L296 296 Z" fill="#172554" />
        </g>

        {state.players.flatMap((player) =>
          state.tokens[player.color].map((position, tokenIndex) => {
            const point = getTokenPoint(player.color, position, tokenIndex);
            const stack = position >= 0 && position !== FINISH_POSITION
              ? tokensAtPoint(state, player.color, position)
              : [];
            const stackIndex = stack.findIndex((token) => token.color === player.color && token.tokenIndex === tokenIndex);
            const offset = stackOffset(stackIndex, stack.length);
            const selectable =
              !interactionDisabled &&
              player.color === activePlayer.color &&
              state.phase === "moving" &&
              state.legalTokenIndexes.includes(tokenIndex);
            const wasMoved = state.lastMove?.playerColor === player.color && state.lastMove.tokenIndex === tokenIndex;
            const meta = COLOR_META[player.color];
            const centreX = (point.x + 0.5 + offset.x) * UNIT;
            const centreY = (point.y + 0.5 + offset.y) * UNIT;
            const tokenName = `${player.name}'s ${meta.label} token ${tokenIndex + 1}`;

            return (
              <motion.g
                key={`${player.color}-${tokenIndex}`}
                role={selectable ? "button" : "img"}
                tabIndex={selectable ? 0 : -1}
                aria-label={selectable ? `${tokenName}; legal move` : tokenName}
                className={`ludo-token ${selectable ? "is-selectable" : ""} ${wasMoved ? "was-moved" : ""}`}
                initial={false}
                animate={{ x: centreX, y: centreY, scale: selectable ? [1, 1.09, 1] : 1 }}
                transition={{
                  x: { type: "spring", stiffness: 190, damping: 18, mass: 0.65 },
                  y: { type: "spring", stiffness: 190, damping: 18, mass: 0.65 },
                  scale: selectable ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : { duration: 0.18 },
                }}
                onClick={() => selectable && onTokenSelect(tokenIndex)}
                onKeyDown={(event) => selectable && onTokenKeyDown(event, () => onTokenSelect(tokenIndex))}
                filter="url(#token-shadow)"
              >
                {selectable && <circle r="23" fill={meta.color} opacity="0.35" filter="url(#glow)" />}
                <circle r="16.5" fill="#051024" stroke={meta.color} strokeWidth="4" />
                <circle cy="-2" r="11" fill={meta.color} />
                <path d="M-9 2 Q0 15 9 2" fill={meta.deep} fillOpacity="0.65" />
                <circle cx="-4" cy="-6" r="3" fill="#ffffff" fillOpacity="0.84" />
                <text x="0" y="6" textAnchor="middle" className="ludo-token-symbol" fill="#071226">
                  {meta.symbol}
                </text>
              </motion.g>
            );
          }),
        )}

        <rect x="3" y="3" width={SVG_SIZE - 6} height={SVG_SIZE - 6} rx="42" fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="2" />
      </svg>
    </div>
  );
};
