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
const HALF = SVG_SIZE / 2;
const STAR_INNER = 6 * UNIT;
const STAR_OUTER = 9 * UNIT;

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
  boardShaking?: boolean;
}

const onTokenKeyDown = (event: KeyboardEvent<SVGGElement>, onSelect: () => void): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
};

export const LudoBoard = ({ state, onTokenSelect, interactionDisabled = false, boardShaking = false }: LudoBoardProps) => {
  const activePlayer = state.players[state.activePlayerIndex];

  return (
    <div className="ludo-board-shell" aria-label="Ludo game board">
      <div className="ludo-board-aura ludo-board-aura-one" aria-hidden="true" />
      <div className="ludo-board-aura ludo-board-aura-two" aria-hidden="true" />
      <svg className={`ludo-board ${boardShaking ? "is-shaking" : ""}`} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} role="img" aria-labelledby="ludo-board-title ludo-board-description">
        <title id="ludo-board-title">A game of Ludo in progress</title>
        <desc id="ludo-board-description">Select one of your highlighted tokens after rolling the dice.</desc>
        <defs>
          {/* Dark walnut wood grain base */}
          <linearGradient id="wood-base" x1="0" x2="0.15" y1="0" y2="1">
            <stop stopColor="#2a1a0c" />
            <stop offset="0.3" stopColor="#3a2510" />
            <stop offset="0.6" stopColor="#2e1c0e" />
            <stop offset="1" stopColor="#241608" />
          </linearGradient>
          <pattern id="wood-grain" width="600" height="600" patternUnits="userSpaceOnUse">
            <rect width="600" height="600" fill="url(#wood-base)" />
            {/* Grain lines */}
            {Array.from({ length: 28 }, (_, i) => (
              <line key={`g${i}`} x1={0} y1={i * 22 + (i % 3) * 5} x2={600} y2={i * 22 + (i % 2) * 8 + 3}
                stroke="#4a3420" strokeOpacity={0.25 + (i % 4) * 0.06} strokeWidth={0.6 + (i % 3) * 0.4} />
            ))}
            {/* Knot accents */}
            <circle cx="120" cy="180" r="8" fill="#1e1008" fillOpacity="0.18" />
            <circle cx="430" cy="350" r="6" fill="#1e1008" fillOpacity="0.14" />
          </pattern>
          {/* Cell emboss filter */}
          <filter id="cell-emboss" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#8b7355" floodOpacity="0.35" />
            <feDropShadow dx="0" dy="-1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.25" />
          </filter>
          <filter id="token-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#020617" floodOpacity="0.65" />
          </filter>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Board frame highlight */}
          <linearGradient id="frame-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#a0855b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#3a2510" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Board base — dark walnut */}
        <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} rx="42" fill="url(#wood-grain)" />
        {/* Carved frame border */}
        <rect x="3" y="3" width={SVG_SIZE - 6} height={SVG_SIZE - 6} rx="40" fill="none"
          stroke="url(#frame-highlight)" strokeWidth="5" />
        <rect x="8" y="8" width={SVG_SIZE - 16} height={SVG_SIZE - 16} rx="36" fill="none"
          stroke="#1a0e06" strokeOpacity="0.5" strokeWidth="2" />

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
                fillOpacity="0.12"
                stroke={meta.color}
                strokeOpacity="0.5"
                strokeWidth="3"
                filter="url(#cell-emboss)"
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
                rx="7"
                fill={meta?.color ?? "#f5edd6"}
                fillOpacity={meta ? 0.88 : 0.85}
                stroke={meta?.deep ?? "#8b7355"}
                strokeOpacity={meta ? 0.75 : 0.4}
                strokeWidth="1.5"
                filter="url(#cell-emboss)"
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
                rx="7"
                fill={meta.color}
                fillOpacity={0.22 + index * 0.08}
                stroke={meta.color}
                strokeOpacity="0.65"
                strokeWidth="1.5"
                filter="url(#cell-emboss)"
              />
            );
          }),
        )}

        <g className="ludo-centre-star" aria-hidden="true">
          <path d={`M${HALF} ${HALF} L${STAR_INNER} ${STAR_INNER} L${HALF} ${STAR_INNER} Z`} fill={COLOR_META.blue.color} fillOpacity="0.88" />
          <path d={`M${HALF} ${HALF} L${STAR_OUTER} ${STAR_INNER} L${STAR_OUTER} ${HALF} Z`} fill={COLOR_META.yellow.color} fillOpacity="0.88" />
          <path d={`M${HALF} ${HALF} L${STAR_OUTER} ${STAR_OUTER} L${HALF} ${STAR_OUTER} Z`} fill={COLOR_META.green.color} fillOpacity="0.88" />
          <path d={`M${HALF} ${HALF} L${STAR_INNER} ${STAR_OUTER} L${STAR_INNER} ${HALF} Z`} fill={COLOR_META.red.color} fillOpacity="0.88" />
          <circle cx={HALF} cy={HALF} r="17" fill="#f8fbff" fillOpacity="0.95" />
          <path d={`M${HALF} ${HALF - 13} L${HALF + 4} ${HALF - 4} L${HALF + 14} ${HALF - 4} L${HALF + 6} ${HALF + 2} L${HALF + 9} ${HALF + 12} L${HALF} ${HALF + 6} L${HALF - 9} ${HALF + 12} L${HALF - 6} ${HALF + 2} L${HALF - 14} ${HALF - 4} L${HALF - 4} ${HALF - 4} Z`} fill="#172554" />
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
                {selectable && <circle r="23" fill={meta.color} opacity="0.4" filter="url(#glow)" />}
                <circle r="17" fill="#0a0500" stroke={meta.color} strokeWidth="3.5" />
                <circle r="14" fill={meta.color} />
                <circle r="14" fill="url(#frame-highlight)" opacity="0.3" />
                <circle cx="-3" cy="-5" r="5" fill="#ffffff" fillOpacity="0.55" />
                <circle cy="-1" r="9" fill={meta.deep} fillOpacity="0.35" />
                <text x="0" y="5" textAnchor="middle" className="ludo-token-symbol" fill="#fff" fillOpacity="0.9">
                  {meta.symbol}
                </text>
              </motion.g>
            );
          }),
        )}

        <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} rx="40" fill="none" stroke="#a0855b" strokeOpacity="0.12" strokeWidth="1.5" />
      </svg>
    </div>
  );
};
