import { ArrowLeft, Bot, Clock3, Crown, Gauge, Sparkles, Volume2, VolumeX, Wifi } from "lucide-react";


import { COLOR_META } from "../game/board";
import { getActivePlayer } from "../game/engine";
import { FINISH_POSITION, type LudoGameState } from "../game/types";
import { Dice3D } from "./Dice3D";



interface GameHudProps {
  state: LudoGameState;
  now: number;
  isDiceRolling: boolean;
  muted: boolean;
  onRoll: () => void;
  onLeave: () => void;
  onSkipTurn: () => void;
  onToggleMute: () => void;
  interactionLocked?: boolean;
}

const secondsRemaining = (turnEndsAt: number, now: number): number => Math.max(0, Math.ceil((turnEndsAt - now) / 1_000));

export const GameHud = ({
  state,
  now,
  isDiceRolling,
  muted,
  onRoll,
  onLeave,
  onSkipTurn,
  onToggleMute,
  interactionLocked = false,
}: GameHudProps) => {
  const active = getActivePlayer(state);
  const activeMeta = COLOR_META[active.color];
  const remaining = secondsRemaining(state.turnEndsAt, now);
  const turnTotal = Math.max(1, state.turnEndsAt - state.turnStartedAt);
  const turnFraction = Math.max(0, Math.min(1, (state.turnEndsAt - now) / turnTotal));
  const canRoll = state.phase === "rolling" && !active.isBot && !interactionLocked;
  const status = state.phase === "finished"
    ? "Match complete"
    : state.phase === "moving"
      ? `Move one ${activeMeta.label} token`
      : active.isBot
        ? `${active.name} is thinking\u2026`
        : `${active.name}, roll the dice`;

  return (
    <>
      <header className="ludo-match-header">
        <button type="button" className="ludo-icon-button" onClick={onLeave} aria-label="Return to Ludo menu">
          <ArrowLeft size={19} />
        </button>
        <div className="ludo-match-brand">
          <span className="ludo-brand-mark"><Sparkles size={16} /></span>
          <div>
            <p>LUDO</p>
            <span>{state.mode === "single" ? "SOLO ARENA" : state.mode === "pass" ? "TABLETOP" : "ONLINE ROOM"}</span>
          </div>
        </div>
        <div className="ludo-header-actions">
          <span className={`ludo-connection ${state.mode === "online" ? "is-online" : ""}`} title={state.mode === "online" ? "Online room transport" : "Local match"}>
            <Wifi size={15} />
            <span>{state.mode === "online" ? "ROOM" : "LOCAL"}</span>
          </span>
          <button type="button" className="ludo-icon-button" onClick={onToggleMute} aria-label={muted ? "Enable game sound" : "Mute game sound"}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      <section className="ludo-turn-panel" style={{ "--turn-colour": activeMeta.color, "--turn-fraction": turnFraction } as React.CSSProperties}>
        <div className="ludo-turn-avatar" style={{ backgroundColor: activeMeta.color }}>
          {active.isBot ? <Bot size={20} /> : active.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="ludo-turn-copy">
          <span className="ludo-eyebrow">{state.phase === "finished" ? "GAME OVER" : "CURRENT TURN"}</span>
          <strong>{status}</strong>
          <span className="ludo-turn-timer" aria-label={`${remaining} seconds remaining`}>
            <Clock3 size={13} />
            <span className="ludo-turn-timer-track"><span className="ludo-turn-timer-fill" /></span>
            <span className="ludo-turn-timer-value">{remaining}s</span>
          </span>
        </div>
        <div className="ludo-turn-actions">
          {state.phase !== "finished" && !interactionLocked && (
            <button type="button" className="ludo-skip-button" onClick={onSkipTurn} title="Skip this turn">
              Skip
            </button>
          )}
          <Dice3D
            value={state.diceValue}
            isRolling={isDiceRolling}
            isReady={canRoll}
            glowColor={activeMeta.color}
            onRoll={onRoll}
            ariaLabel={canRoll ? "Roll the dice" : `Dice showing ${state.diceValue ?? "no value"}`}
          />
        </div>
      </section>

      <section className="ludo-player-strip" aria-label="Players">
        {state.players.map((player) => {
          const meta = COLOR_META[player.color];
          const isActive = player.id === active.id && state.phase !== "finished";
          const finished = state.tokens[player.color].filter((position) => position === FINISH_POSITION).length;
          const rank = state.winnerOrder.indexOf(player.color);
          return (
            <article
              className={`ludo-player-card ${isActive ? "is-active" : ""} ${state.winnerOrder.includes(player.color) ? "is-ranked" : ""}`}
              style={{ "--player-colour": meta.color, "--player-pale": meta.pale } as React.CSSProperties}
              key={player.id}
            >
              <span className="ludo-player-orb">{player.isBot ? <Bot size={15} /> : player.name.slice(0, 1).toUpperCase()}</span>
              <span className="ludo-player-details">
                <strong>{player.name}</strong>
                <small>
                  {rank >= 0 ? <><Crown size={12} /> #{rank + 1}</> : player.isBot ? "BOT" : `${finished}/4 HOME`}
                </small>
                <span className="ludo-player-pips" aria-hidden="true">
                  {[0, 1, 2, 3].map((pip) => (
                    <i key={pip} className={pip < finished ? "is-home" : ""} />
                  ))}
                </span>
              </span>
              {typeof player.pingMs === "number" && (
                <span className="ludo-ping"><Gauge size={12} />{player.pingMs}ms</span>
              )}
              <span className="ludo-player-colour" aria-label={`${meta.label} player`} />
            </article>
          );
        })}
      </section>
    </>
  );
};
