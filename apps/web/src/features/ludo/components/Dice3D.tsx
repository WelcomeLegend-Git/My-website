import { useEffect, useRef, useState } from "react";
import "./dice3d.css";

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Rotation needed to show each face value forward. */
const FACE_ROTATION: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(-90deg) rotateY(0deg)",
  3: "rotateX(0deg) rotateY(-90deg)",
  4: "rotateX(0deg) rotateY(90deg)",
  5: "rotateX(90deg) rotateY(0deg)",
  6: "rotateX(0deg) rotateY(180deg)",
};

interface Dice3DProps {
  value: number | null;
  isRolling: boolean;
  isReady: boolean;
  glowColor: string;
  onRoll: () => void;
  ariaLabel: string;
}

const DiceFace = ({ faceValue, faceIndex }: { faceValue: number; faceIndex: number }) => (
  <div className={`dice3d-face dice3d-face-${faceIndex}`}>
    {PIP_MAP[faceValue].map((slot) => (
      <i key={slot} className={`dice3d-pip dice3d-pip-${slot}`} />
    ))}
  </div>
);

export const Dice3D = ({ value, isRolling, isReady, glowColor, onRoll, ariaLabel }: Dice3DProps) => {
  const [justLanded, setJustLanded] = useState(false);
  const prevRolling = useRef(isRolling);
  const lastValueRef = useRef<number>(1);

  if (value !== null && value !== undefined) {
    lastValueRef.current = value;
  }

  // Detect roll → land transition for bounce
  useEffect(() => {
    if (prevRolling.current && !isRolling) {
      setJustLanded(true);
      const t = setTimeout(() => setJustLanded(false), 320);
      return () => clearTimeout(t);
    }
    prevRolling.current = isRolling;
  }, [isRolling]);

  const showValue = value ?? lastValueRef.current;
  const cubeTransform = isRolling ? undefined : FACE_ROTATION[showValue];

  return (
    <button
      type="button"
      className={`dice3d-scene ${isReady ? "is-ready" : ""}`}
      style={{ "--dice-glow-color": glowColor } as React.CSSProperties}
      onClick={onRoll}
      disabled={!isReady || isRolling}
      aria-label={ariaLabel}
    >
      <div
        className={`dice3d-cube ${isRolling ? "is-rolling" : ""} ${justLanded ? "just-landed" : ""}`}
        style={cubeTransform ? { transform: cubeTransform } : undefined}
      >
        <DiceFace faceValue={1} faceIndex={1} />
        <DiceFace faceValue={2} faceIndex={2} />
        <DiceFace faceValue={3} faceIndex={3} />
        <DiceFace faceValue={4} faceIndex={4} />
        <DiceFace faceValue={5} faceIndex={5} />
        <DiceFace faceValue={6} faceIndex={6} />
      </div>
      <div className="dice3d-shadow" />
      {isReady && <span className="dice3d-label">ROLL</span>}
    </button>
  );
};
