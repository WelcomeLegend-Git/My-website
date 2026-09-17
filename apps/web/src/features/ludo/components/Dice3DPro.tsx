import React, { useEffect, useRef, useState } from "react";
import { useLudoReducedMotion } from "../effects/useLudoReducedMotion";
import "./dice3dPro.css";

export type PlayerColor = "red" | "blue" | "yellow" | "green";
export type ArrowDirection = "right" | "left" | "up" | "down";

export interface Dice3DProProps {
  value: number | null;
  isRolling: boolean;
  isReady: boolean;
  playerColor: PlayerColor;
  arrowDirection?: ArrowDirection;
  onRoll: () => void;
  ariaLabel?: string;
  size?: number;
}

export const PLAYER_PALETTE: Record<
  PlayerColor,
  { color: string; deep: string; glow: string; pale: string }
> = {
  red: { color: "#ff4f70", deep: "#a91543", glow: "rgba(255, 79, 112, 0.75)", pale: "#ffdee5" },
  blue: { color: "#3b9dff", deep: "#1264c5", glow: "rgba(59, 157, 255, 0.75)", pale: "#d9efff" },
  yellow: { color: "#f7c84b", deep: "#b77a05", glow: "rgba(247, 200, 75, 0.75)", pale: "#fff2bd" },
  green: { color: "#32d39a", deep: "#0b9470", glow: "rgba(50, 211, 154, 0.75)", pale: "#d9fff1" },
};

/** Rotation required to display each face squarely forward (flush). */
export const DICE_FACE_ROTATIONS: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(-90deg) rotateY(0deg)",
  3: "rotateX(0deg) rotateY(-90deg)",
  4: "rotateX(0deg) rotateY(90deg)",
  5: "rotateX(90deg) rotateY(0deg)",
  6: "rotateX(0deg) rotateY(180deg)",
};

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DiceFace = ({ faceNumber }: { faceNumber: number }) => (
  <div
    className={`dice3d-pro-face dice3d-face dice3d-pro-face-${faceNumber} dice3d-face-${faceNumber}`}
    data-face={faceNumber}
  >
    {PIP_MAP[faceNumber].map((slot) => (
      <i
        key={slot}
        className={`dice3d-pro-pip dice3d-pip dice3d-pro-pip-${slot} dice3d-pip-${slot}`}
      />
    ))}
  </div>
);

const PointingArrow = ({
  direction,
}: {
  direction: ArrowDirection;
}) => {
  // Arrow rotation towards the cube:
  // right: 0deg, down: 90deg, left: 180deg, up: 270deg
  const rotationDegrees: Record<ArrowDirection, number> = {
    right: 0,
    down: 90,
    left: 180,
    up: 270,
  };

  return (
    <div
      className={`dice3d-pro-arrow dice3d-pro-arrow-${direction}`}
      data-direction={direction}
      aria-hidden="true"
    >
      <svg
        className="dice3d-pro-arrow-svg"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: `rotate(${rotationDegrees[direction]}deg)` }}
      >
        <path
          d="M4 12h12M11 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const Dice3DPro = ({
  value,
  isRolling,
  isReady,
  playerColor,
  arrowDirection = "up",
  onRoll,
  ariaLabel,
  size = 60,
}: Dice3DProProps) => {
  const reducedMotion = useLudoReducedMotion();
  const [justLanded, setJustLanded] = useState(false);
  const [displayValue, setDisplayValue] = useState(value ?? 1);
  const [tumbleVariant, setTumbleVariant] = useState(0);
  const prevRolling = useRef(isRolling);

  useEffect(() => {
    if (value !== null && value !== undefined) {
      setDisplayValue(value);
    }
  }, [value]);

  // Coordinated roll-start randomization & land double-bounce physics
  useEffect(() => {
    const landed = prevRolling.current && !isRolling;
    const started = !prevRolling.current && isRolling;
    prevRolling.current = isRolling;

    if (started && !reducedMotion) {
      // Pick a random tumble axis choreography variant (0..3)
      setTumbleVariant(Math.floor(Math.random() * 4));
    }

    if (landed && !reducedMotion) {
      setJustLanded(true);
      const timer = setTimeout(() => {
        setJustLanded(false);
      }, 340);
      return () => clearTimeout(timer);
    } else if (!landed && !isRolling) {
      setJustLanded(false);
    }
  }, [isRolling, reducedMotion]);

  const cubeTransform = DICE_FACE_ROTATIONS[value ?? displayValue] ?? DICE_FACE_ROTATIONS[1];
  const palette = PLAYER_PALETTE[playerColor] ?? PLAYER_PALETTE.yellow;

  const computedAriaLabel =
    ariaLabel ??
    (isReady
      ? "Your turn to roll"
      : isRolling
        ? "Rolling dice…"
        : value !== null && value !== undefined
          ? `Roll dice; value ${value}`
          : "Roll dice");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === "Enter" || event.key === " ") && isReady && !isRolling) {
      event.preventDefault();
      onRoll();
    }
  };

  const showArrow = isReady && !isRolling && Boolean(arrowDirection);

  const styleVariables: React.CSSProperties = {
    "--dice-size": `${size}px`,
    "--player-color": palette.color,
    "--player-glow": palette.glow,
    "--player-deep": palette.deep,
    "--player-pale": palette.pale,
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className={`dice3d-pro-scene dice3d-scene ${isReady ? "is-ready" : ""}`}
      style={styleVariables}
      onClick={onRoll}
      onKeyDown={handleKeyDown}
      disabled={!isReady || isRolling}
      aria-label={computedAriaLabel}
    >
      {showArrow && <PointingArrow direction={arrowDirection} />}

      <div
        className={`dice3d-pro-hop-shell dice3d-bounce-shell ${
          isRolling && !reducedMotion ? "is-hopping" : ""
        } ${justLanded && !reducedMotion ? "is-landing just-landed" : ""}`}
        aria-hidden="true"
      >
        <div
          className={`dice3d-pro-tumbler ${
            isRolling && !reducedMotion ? `is-tumble-${tumbleVariant} is-rolling` : ""
          }`}
        >
          <div
            className={`dice3d-pro-cube dice3d-cube`}
            style={{ transform: cubeTransform }}
          >
            <DiceFace faceNumber={1} />
            <DiceFace faceNumber={2} />
            <DiceFace faceNumber={3} />
            <DiceFace faceNumber={4} />
            <DiceFace faceNumber={5} />
            <DiceFace faceNumber={6} />
          </div>
        </div>
      </div>

      <div
        className={`dice3d-pro-shadow dice3d-shadow ${
          isRolling && !reducedMotion ? "is-hopping" : ""
        } ${justLanded && !reducedMotion ? "is-landing" : ""}`}
        aria-hidden="true"
      />

      <span className="dice3d-pro-label dice3d-label" aria-hidden="true">
        {isRolling ? "ROLLING" : isReady ? "ROLL" : (value ?? "—")}
      </span>
    </button>
  );
};
