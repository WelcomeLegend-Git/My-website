import { forfeitTurn, getActivePlayer, LudoRuleError, moveToken, rollDice } from "./engine";
import type { LudoGameState, MoveResult } from "./types";

export interface LocalControllerState {
  game: LudoGameState | null;
  now: number;
  isDiceRolling: boolean;
  handoffPlayerName: string | null;
  lastMoveResult: MoveResult | null;
}

export type LocalControllerAction =
  | { type: "start"; game: LudoGameState; now: number }
  | { type: "leave"; now: number }
  | { type: "tick" | "roll-start" | "dismiss" | "skip"; now: number }
  | { type: "roll-end"; value: number; now: number }
  | { type: "move"; tokenIndex: number; now: number };

export const initialLocalController = (now: number): LocalControllerState => ({
  game: null, now, isDiceRolling: false, handoffPlayerName: null, lastMoveResult: null,
});

const acceptGame = (
  state: LocalControllerState,
  game: LudoGameState,
  now: number,
  lastMoveResult: MoveResult | null = state.lastMoveResult,
): LocalControllerState => ({
  ...state,
  game,
  now,
  lastMoveResult,
  isDiceRolling: false,
  handoffPlayerName: game.mode === "pass" && game.phase === "rolling" &&
    state.game?.activePlayerIndex !== game.activePlayerIndex ? getActivePlayer(game).name : null,
});

// All time and randomness are supplied by the hook, never sampled during a transition.
export const reduceLocalController = (
  state: LocalControllerState,
  action: LocalControllerAction,
): LocalControllerState => {
  if (action.type === "start") return { ...initialLocalController(action.now), game: action.game };
  if (action.type === "leave") return initialLocalController(action.now);
  const game = state.game;
  if (!game || game.phase === "finished") {
    return action.type === "tick" ? { ...state, now: action.now } : state;
  }
  if (state.handoffPlayerName !== null) {
    if (action.type === "dismiss") {
      return {
        ...state,
        now: action.now,
        handoffPlayerName: null,
        game: { ...game, turnStartedAt: action.now,
          turnEndsAt: action.now + game.rules.turnDurationSeconds * 1_000,
          revision: game.revision + 1 },
      };
    }
    return action.type === "tick" ? { ...state, now: action.now } : state;
  }
  if (action.type === "dismiss") return state;
  // Check at the action boundary too: an animation or click can beat the next clock tick.
  if (game.rules.turnDurationSeconds > 0 && action.now >= game.turnEndsAt) {
    return acceptGame(state, forfeitTurn(game, action.now, "timeout"), action.now);
  }
  switch (action.type) {
    case "tick": return { ...state, now: action.now };
    case "skip": return acceptGame(state, forfeitTurn(game, action.now, "manual"), action.now);
    case "roll-start":
      return game.phase === "rolling" && !state.isDiceRolling ? { ...state, isDiceRolling: true } : state;
    case "roll-end":
      if (!state.isDiceRolling || game.phase !== "rolling") return state;
      return acceptGame(state, rollDice(game, action.value, action.now), action.now);
    case "move": {
      if (game.phase !== "moving") return state;
      try {
        const result = moveToken(game, action.tokenIndex, action.now);
        return acceptGame(state, result.state, action.now, result);
      } catch (error) {
        // Stale/double clicks are expected; programming errors must remain visible.
        if (error instanceof LudoRuleError) return state;
        throw error;
      }
    }
  }
};
