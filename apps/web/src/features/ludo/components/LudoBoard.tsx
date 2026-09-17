import { motion } from "framer-motion";
import { useId, type KeyboardEvent } from "react";
import { useLudoReducedMotion } from "../effects/useLudoReducedMotion";
import { useGotiAnimator, GotiCelebrationBurst } from "../effects/useGotiAnimator";

import {
  BOARD_UNITS,
  COLOR_META,
  getTokenPoint,
  HOME_LANE_CELLS,
  HOME_SLOTS,
  RING_CELLS,
  stackOffset,
  tokensAtPoint,
} from "../game/board";
import { getCaptures, getDestination, isSafeRingIndex } from "../game/engine";
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

const START_ARROW_ROTATION: Record<PlayerColor, number> = {
  red: 0,      // moves right (+x)
  blue: 90,    // moves down (+y)
  yellow: 180, // moves left (-x)
  green: 270,  // moves up (-y)
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
  const reducedMotion = useLudoReducedMotion();
  const boardId = useId();
  const { getTokenAnimationProps, celebrations } = useGotiAnimator({
    state,
    unit: UNIT,
    reducedMotion,
  });

  return (
    <div className="ludo-board-shell" aria-label="Ludo game board">
      <div className="ludo-board-aura ludo-board-aura-one" aria-hidden="true" />
      <div className="ludo-board-aura ludo-board-aura-two" aria-hidden="true" />
      <svg className={`ludo-board ${boardShaking ? "is-shaking" : ""}`} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} role="group" aria-labelledby={`${boardId}-title`} aria-describedby={`${boardId}-description`}>
        <title id={`${boardId}-title`}>Ludo token board</title>
        <desc id={`${boardId}-description`}>Tab to a highlighted token and press Enter or Space to move. Numbered move buttons are also available below the board.</desc>
        <defs>
          {/* Dark walnut wood grain base */}
          <linearGradient id={`${boardId}-wood-base`} x1="0" x2="0.15" y1="0" y2="1">
            <stop stopColor="#2a1a0c" />
            <stop offset="0.3" stopColor="#3a2510" />
            <stop offset="0.6" stopColor="#2e1c0e" />
            <stop offset="1" stopColor="#241608" />
          </linearGradient>
          <pattern id={`${boardId}-wood-grain`} width="600" height="600" patternUnits="userSpaceOnUse">
            <rect width="600" height="600" fill={`url(#${boardId}-wood-base)`} />
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
          <filter id={`${boardId}-cell-emboss`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#8b7355" floodOpacity="0.35" />
            <feDropShadow dx="0" dy="-1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.25" />
          </filter>
          <filter id={`${boardId}-token-shadow`} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#020617" floodOpacity="0.65" />
          </filter>
          <filter id={`${boardId}-yard-inner-shadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
          <filter id={`${boardId}-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Board frame highlight */}
          <linearGradient id={`${boardId}-frame-highlight`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#a0855b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#3a2510" stopOpacity="0.3" />
          </linearGradient>
          {/* 3D token gradients */}
          {(Object.keys(COLOR_META) as PlayerColor[]).map((color) => (
            <radialGradient id={`${boardId}-token-grad-${color}`} key={color} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="25%" stopColor={COLOR_META[color].color} />
              <stop offset="85%" stopColor={COLOR_META[color].deep} />
              <stop offset="100%" stopColor="#080402" />
            </radialGradient>
          ))}
        </defs>

        {/* Board base — dark walnut */}
        <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} rx="42" fill={`url(#${boardId}-wood-grain)`} />
        {/* Carved frame border */}
        <rect x="3" y="3" width={SVG_SIZE - 6} height={SVG_SIZE - 6} rx="40" fill="none"
          stroke={`url(#${boardId}-frame-highlight)`} strokeWidth="5" />
        <rect x="8" y="8" width={SVG_SIZE - 16} height={SVG_SIZE - 16} rx="36" fill="none"
          stroke="#1a0e06" strokeOpacity="0.5" strokeWidth="2" />

        {yardShapes.map(({ color, x, y }) => {
          const meta = COLOR_META[color];
          const slots = HOME_SLOTS[color];
          return (
            <g key={color} className="ludo-yard-group">
              {/* Outer colored yard base */}
              <rect
                x={x * UNIT + 8}
                y={y * UNIT + 8}
                width={6 * UNIT - 16}
                height={6 * UNIT - 16}
                rx="22"
                fill={meta.color}
                fillOpacity="0.94"
                stroke={meta.deep}
                strokeWidth="2.5"
                filter={`url(#${boardId}-cell-emboss)`}
              />
              {/* Inner white container box (Ludo King style) */}
              <rect
                x={(x + 0.8) * UNIT}
                y={(y + 0.8) * UNIT}
                width={4.4 * UNIT}
                height={4.4 * UNIT}
                rx="18"
                fill="#ffffff"
                stroke={meta.deep}
                strokeWidth="2"
                strokeOpacity="0.25"
                filter={`url(#${boardId}-yard-inner-shadow)`}
              />
              {/* 4 circular token sockets */}
              {slots.map((slot, sIdx) => {
                const cx = (slot.x + 0.5) * UNIT;
                const cy = (slot.y + 0.5) * UNIT;
                return (
                  <g key={`socket-${color}-${sIdx}`}>
                    {/* Outer colored bevel ring */}
                    <circle cx={cx} cy={cy} r="25" fill={meta.pale} stroke={meta.color} strokeWidth="3" />
                    {/* Inner dish */}
                    <circle cx={cx} cy={cy} r="19" fill="#f8fafc" stroke={meta.deep} strokeWidth="1.5" strokeOpacity="0.4" />
                    {/* Center decorative indent */}
                    <circle cx={cx} cy={cy} r="6" fill={meta.color} fillOpacity="0.25" />
                    <circle cx={cx} cy={cy} r="2.5" fill={meta.deep} fillOpacity="0.6" />
                  </g>
                );
              })}
              {/* Yard Center Label */}
              <text
                x={(x + 3) * UNIT}
                y={(y + 3) * UNIT + 4}
                textAnchor="middle"
                className="ludo-yard-label"
                fill={meta.deep}
                fillOpacity="0.32"
                style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2.5px" }}
              >
                {meta.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {RING_CELLS.map((cell, index) => {
          const startColor = colorAtStart[index];
          const safe = isSafeRingIndex(index);
          const meta = startColor ? COLOR_META[startColor] : null;
          const cx = (cell.x + 0.5) * UNIT;
          const cy = (cell.y + 0.5) * UNIT;

          return (
            <g key={`ring-${index}`}>
              <rect
                x={cell.x * UNIT + 2}
                y={cell.y * UNIT + 2}
                width={UNIT - 4}
                height={UNIT - 4}
                rx="6"
                fill={meta ? meta.color : "#ffffff"}
                fillOpacity={meta ? 0.94 : 0.96}
                stroke={meta ? meta.deep : "#dcd3c4"}
                strokeWidth={meta ? 2 : 1.2}
                filter={`url(#${boardId}-cell-emboss)`}
              />
              {startColor ? (
                /* Ludo King Forward Start Arrow */
                <g transform={`translate(${cx}, ${cy}) rotate(${START_ARROW_ROTATION[startColor]})`}>
                  <polygon
                    points="-9,-4 0,-4 0,-8 9,0 0,8 0,4 -9,4"
                    fill="#ffffff"
                    stroke={meta?.deep ?? "#000000"}
                    strokeWidth="1"
                    strokeOpacity="0.35"
                  />
                </g>
              ) : safe ? (
                /* Centered Golden Safe Star */
                <g transform={`translate(${cx}, ${cy})`}>
                  <path
                    d="M 0 -10 L 2.6 -3.6 L 9.5 -3.1 L 4.3 1.4 L 5.9 8 L 0 4.5 L -5.9 8 L -4.3 1.4 L -9.5 -3.1 L -2.6 -3.6 Z"
                    fill="#f59e0b"
                    stroke="#b45309"
                    strokeWidth="1"
                  />
                </g>
              ) : null}
            </g>
          );
        })}

        {(Object.keys(HOME_LANE_CELLS) as PlayerColor[]).flatMap((color) =>
          HOME_LANE_CELLS[color].map((cell, index) => {
            const meta = COLOR_META[color];
            const cx = (cell.x + 0.5) * UNIT;
            const cy = (cell.y + 0.5) * UNIT;
            return (
              <g key={`${color}-lane-${index}`}>
                <rect
                  x={cell.x * UNIT + 2}
                  y={cell.y * UNIT + 2}
                  width={UNIT - 4}
                  height={UNIT - 4}
                  rx="6"
                  fill={meta.color}
                  fillOpacity={0.45 + index * 0.11}
                  stroke={meta.deep}
                  strokeOpacity="0.75"
                  strokeWidth="1.5"
                  filter={`url(#${boardId}-cell-emboss)`}
                />
                <g transform={`translate(${cx}, ${cy}) rotate(${START_ARROW_ROTATION[color]})`} opacity={0.35 + index * 0.12}>
                  <path d="M -4 -5 L 3 0 L -4 5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </g>
            );
          }),
        )}

        <g className="ludo-centre-star" aria-hidden="true">
          {/* Left triangle (Red) */}
          <path d={`M${HALF} ${HALF} L${STAR_INNER} ${STAR_INNER} L${STAR_INNER} ${STAR_OUTER} Z`} fill={COLOR_META.red.color} fillOpacity="0.92" />
          {/* Top triangle (Blue) */}
          <path d={`M${HALF} ${HALF} L${STAR_INNER} ${STAR_INNER} L${STAR_OUTER} ${STAR_INNER} Z`} fill={COLOR_META.blue.color} fillOpacity="0.92" />
          {/* Right triangle (Yellow) */}
          <path d={`M${HALF} ${HALF} L${STAR_OUTER} ${STAR_INNER} L${STAR_OUTER} ${STAR_OUTER} Z`} fill={COLOR_META.yellow.color} fillOpacity="0.92" />
          {/* Bottom triangle (Green) */}
          <path d={`M${HALF} ${HALF} L${STAR_INNER} ${STAR_OUTER} L${STAR_OUTER} ${STAR_OUTER} Z`} fill={COLOR_META.green.color} fillOpacity="0.92" />
          <circle cx={HALF} cy={HALF} r="18" fill="#ffffff" stroke="#c9a86a" strokeWidth="2" />
          <path
            d={`M ${HALF} ${HALF - 11} L ${HALF + 2.8} ${HALF - 4} L ${HALF + 10} ${HALF - 3.4} L ${HALF + 4.5} ${HALF + 1.5} L ${HALF + 6.2} ${HALF + 8.5} L ${HALF} ${HALF + 4.8} L ${HALF - 6.2} ${HALF + 8.5} L ${HALF - 4.5} ${HALF + 1.5} L ${HALF - 10} ${HALF - 3.4} L ${HALF - 2.8} ${HALF - 4} Z`}
            fill="#f59e0b"
            stroke="#b45309"
            strokeWidth="1"
          />
        </g>

        {state.phase === "moving" &&
          state.diceValue !== null &&
          !interactionDisabled &&
          state.legalTokenIndexes.map((tokenIndex) => {
            const from = state.tokens[activePlayer.color][tokenIndex];
            const destination = getDestination(from, state.diceValue ?? 0, state.rules.requireSixToLeaveHome);
            if (destination === null) return null;
            const point = getTokenPoint(activePlayer.color, destination, tokenIndex);
            const captures = getCaptures(state, activePlayer.color, destination).length > 0;
            const meta = COLOR_META[activePlayer.color];
            return (
              <motion.g
                key={`dest-${tokenIndex}`}
                className={`ludo-dest-marker ${captures ? "is-capture" : ""}`}
                initial={false}
                animate={{ x: (point.x + 0.5) * UNIT, y: (point.y + 0.5) * UNIT }}
                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 18, mass: 0.65 }}
                aria-hidden="true"
              >
                <circle r="24" fill="none" stroke={captures ? "#ff6b88" : meta.color} strokeWidth="3" strokeDasharray="6 7" className="ludo-dest-ring" />
                {captures && <circle r="10" fill="#ff6b88" opacity="0.85" />}
              </motion.g>
            );
          })}

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
            const location = position < 0 ? "in the yard" : position === FINISH_POSITION ? "home" : `at step ${position + 1}`;
            const tokenName = `${player.name}'s ${meta.label} token ${tokenIndex + 1}, ${location}`;

            const animProps = getTokenAnimationProps(player.color, tokenIndex, centreX, centreY, selectable);

            return (
              <motion.g
                key={`${player.color}-${tokenIndex}`}
                role={selectable ? "button" : "img"}
                tabIndex={selectable ? 0 : -1}
                aria-label={selectable ? `${tokenName}; legal move` : tokenName}
                className={`ludo-token ${selectable ? "is-selectable" : ""} ${wasMoved ? "was-moved" : ""} ${animProps.isAnimating ? "is-hopping" : ""} ${animProps.isCapturedFlight ? "is-captured-flight" : ""}`}
                initial={false}
                animate={{
                  x: animProps.x,
                  y: animProps.y,
                  scale: animProps.scale ?? (selectable && !reducedMotion ? [1, 1.09, 1] : 1),
                  scaleX: animProps.scaleX,
                  scaleY: animProps.scaleY,
                  rotate: animProps.rotate,
                }}
                transition={animProps.transition}
                onClick={() => selectable && onTokenSelect(tokenIndex)}
                onKeyDown={(event) => selectable && onTokenKeyDown(event, () => onTokenSelect(tokenIndex))}
                filter={`url(#${boardId}-token-shadow)`}
              >
                {/* Selectable pulsing halo */}
                {selectable && <circle r="23" fill={meta.color} opacity="0.45" filter={`url(#${boardId}-glow)`} />}
                {/* 3D Goti Base Tier / Rim */}
                <circle r="18" fill={meta.deep} stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.45" />
                {/* 3D Domed Body with radial gradient */}
                <circle r="15" fill={`url(#${boardId}-token-grad-${player.color})`} />
                {/* Glossy specular highlight arc */}
                <ellipse cx="-4" cy="-5" rx="6" ry="3.5" transform="rotate(-25 -4 -5)" fill="#ffffff" fillOpacity="0.75" />
                {/* Inner center disc for number contrast */}
                <circle r="9.5" fill={meta.deep} fillOpacity="0.35" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.5" />
                {/* Number */}
                <text x="0" y="4.5" textAnchor="middle" className="ludo-token-symbol" fill="#ffffff" fontWeight="900" fontSize="13px">
                  {tokenIndex + 1}
                </text>
              </motion.g>
            );
          }),
        )}

        {celebrations.map((c) => (
          <GotiCelebrationBurst
            key={c.id}
            cx={(c.point.x + 0.5) * UNIT}
            cy={(c.point.y + 0.5) * UNIT}
            color={c.color}
            boardId={boardId}
          />
        ))}

        <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} rx="40" fill="none" stroke="#a0855b" strokeOpacity="0.12" strokeWidth="1.5" />
      </svg>
    </div>
  );
};
