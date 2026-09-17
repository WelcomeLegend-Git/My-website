import { Bot, Crown } from "lucide-react";
import React from "react";
import { COLOR_META } from "../game/board";
import { FINISH_POSITION, type LudoGameState, type LudoPlayer } from "../game/types";
import { Dice3DPro, type ArrowDirection } from "./Dice3DPro";

export type StationCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface CornerPlayerStationProps {
  player: LudoPlayer;
  state: LudoGameState;
  isActive: boolean;
  isDiceRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  corner: StationCorner;
  interactionLocked?: boolean;
}

const CORNER_ARROW_DIRECTION: Record<StationCorner, ArrowDirection> = {
  "top-left": "right",
  "bottom-left": "right",
  "top-right": "left",
  "bottom-right": "left",
};

export const CornerPlayerStation = ({
  player,
  state,
  isActive,
  isDiceRolling,
  canRoll,
  onRoll,
  corner,
  interactionLocked = false,
}: CornerPlayerStationProps) => {
  const meta = COLOR_META[player.color];
  const finishedCount = state.tokens[player.color]?.filter(
    (pos) => pos === FINISH_POSITION,
  ).length ?? 0;
  const rank = state.winnerOrder.indexOf(player.color);
  const arrowDirection = CORNER_ARROW_DIRECTION[corner];

  const rollable = isActive && canRoll && !interactionLocked;

  return (
    <div
      className={`ludo-corner-station ludo-corner-${corner} ${
        isActive ? "is-active" : ""
      } ${rank >= 0 ? "is-ranked" : ""}`}
      style={
        {
          "--station-color": meta.color,
          "--station-deep": meta.deep,
          "--station-pale": meta.pale,
        } as React.CSSProperties
      }
      data-corner={corner}
      data-player={player.color}
    >
      {/* Player Header Card */}
      <div className="ludo-station-profile">
        <div
          className="ludo-station-avatar"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        >
          {player.isBot ? <Bot size={18} /> : player.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="ludo-station-meta">
          <div className="ludo-station-name-row">
            <strong className="ludo-station-name" title={player.name}>
              {player.name}
            </strong>
            {rank >= 0 && (
              <span className="ludo-station-rank" title={`Rank #${rank + 1}`}>
                <Crown size={12} /> #{rank + 1}
              </span>
            )}
          </div>
          <div className="ludo-station-sub">
            <span className="ludo-station-home-stat">
              {finishedCount}/4 home{player.isBot ? " · Bot" : ""}
            </span>
            <span className="ludo-station-home-pips" aria-hidden="true">
              {[0, 1, 2, 3].map((pip) => (
                <i
                  key={pip}
                  className={`ludo-station-pip ${pip < finishedCount ? "is-home" : ""}`}
                />
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Dice Roller Plate */}
      <div className="ludo-station-dice-wrapper">
        <Dice3DPro
          value={isActive ? state.diceValue : null}
          isRolling={isActive && isDiceRolling}
          isReady={rollable}
          playerColor={player.color}
          arrowDirection={arrowDirection}
          onRoll={onRoll}
          ariaLabel={
            rollable
              ? `${player.name}'s turn to roll the dice`
              : `${player.name}'s dice`
          }
          size={58}
        />
      </div>
    </div>
  );
};
