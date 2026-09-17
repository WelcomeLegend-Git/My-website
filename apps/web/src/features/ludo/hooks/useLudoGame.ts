import { useCallback, useEffect, useRef, useState } from "react";

import { chooseBotMove, createGame, getActivePlayer, rollLocalDice } from "../game/engine";
import { initialLocalController, reduceLocalController, type LocalControllerAction } from "../game/localController";
import type { GameSetup, LudoGameState, MoveResult } from "../game/types";

export interface LudoGameController {
  game: LudoGameState | null;
  now: number;
  isDiceRolling: boolean;
  handoffPlayerName: string | null;
  start: (setup: GameSetup) => void;
  restart: () => void;
  leave: () => void;
  roll: () => void;
  move: (tokenIndex: number) => void;
  dismissHandoff: () => void;
  skipTurn: () => void;
  lastMoveResult: MoveResult | null;
}

export const useLudoGame = (): LudoGameController => {
  const [state, setState] = useState(() => initialLocalController(Date.now()));
  // Commands serialize against this snapshot, including repeated calls in one React batch.
  // React only receives completed values: no entropy, throws or nested setters in updaters.
  const current = useRef(state);
  const latestSetup = useRef<GameSetup | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const diceTimer = useRef<number | null>(null);
  const botTimer = useRef<number | null>(null);

  const invalidateTimers = useCallback(() => {
    generation.current += 1;
    if (diceTimer.current !== null) window.clearTimeout(diceTimer.current);
    if (botTimer.current !== null) window.clearTimeout(botTimer.current);
    diceTimer.current = null;
    botTimer.current = null;
  }, []);

  const dispatch = useCallback((action: LocalControllerAction) => {
    if (!mounted.current) return;
    const previous = current.current;
    const next = reduceLocalController(previous, action);
    if (previous === next) return;
    if (next.game !== previous.game || (previous.isDiceRolling && !next.isDiceRolling)) invalidateTimers();
    current.current = next;
    setState(next);
  }, [invalidateTimers]);

  const start = useCallback((setup: GameSetup) => {
    if (!mounted.current) return;
    const now = Date.now();
    // Validate first, so a rejected setup cannot partially reset a running match.
    const game = createGame({ ...setup, now });
    latestSetup.current = {
      ...setup,
      players: game.players.map((player) => ({ ...player })),
      rules: { ...game.rules },
    };
    dispatch({ type: "start", game, now });
  }, [dispatch]);

  const restart = useCallback(() => {
    if (latestSetup.current) start(latestSetup.current);
  }, [start]);

  const leave = useCallback(() => {
    latestSetup.current = null;
    dispatch({ type: "leave", now: Date.now() });
  }, [dispatch]);

  const roll = useCallback(() => dispatch({ type: "roll-start", now: Date.now() }), [dispatch]);
  const move = useCallback((tokenIndex: number) => dispatch({ type: "move", tokenIndex, now: Date.now() }), [dispatch]);
  const dismissHandoff = useCallback(() => dispatch({ type: "dismiss", now: Date.now() }), [dispatch]);
  const skipTurn = useCallback(() => dispatch({ type: "skip", now: Date.now() }), [dispatch]);

  useEffect(() => {
    mounted.current = true;
    const interval = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), 250);
    return () => {
      mounted.current = false;
      // Effect cleanup can be replayed without discarding state; only leave clears setup.
      invalidateTimers();
      window.clearInterval(interval);
    };
  }, [dispatch, invalidateTimers]);

  const { game, isDiceRolling, handoffPlayerName } = state;
  useEffect(() => {
    if (!game || game.phase === "finished" || handoffPlayerName !== null) return;
    const scheduledGeneration = generation.current;
    const isCurrent = () => mounted.current && generation.current === scheduledGeneration && current.current.game === game;
    if (isDiceRolling) {
      const timer = window.setTimeout(() => {
        if (!isCurrent()) return;
        diceTimer.current = null;
        dispatch({ type: "roll-end", value: rollLocalDice(), now: Date.now() });
      }, 560);
      diceTimer.current = timer;
      return () => {
        window.clearTimeout(timer);
        if (diceTimer.current === timer) diceTimer.current = null;
      };
    }
    if (!getActivePlayer(game).isBot) return;
    const timer = window.setTimeout(() => {
      if (!isCurrent()) return;
      botTimer.current = null;
      if (game.phase === "rolling") roll();
      else if (game.phase === "moving") {
        const tokenIndex = chooseBotMove(game);
        if (tokenIndex !== null) move(tokenIndex);
      }
    }, game.phase === "rolling" ? 720 : 580);
    botTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (botTimer.current === timer) botTimer.current = null;
    };
  }, [game, handoffPlayerName, isDiceRolling, dispatch, move, roll]);

  return { ...state, start, restart, leave, roll, move, dismissHandoff, skipTurn };
};
