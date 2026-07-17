import { useCallback, useEffect, useRef, useState } from "react";

import {
  chooseBotMove,
  createGame,
  forfeitTurn,
  getActivePlayer,
  moveToken,
  rollDice,
  rollLocalDice,
} from "../game/engine";
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
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [handoffPlayerName, setHandoffPlayerName] = useState<string | null>(null);
  const latestSetup = useRef<GameSetup | null>(null);
  const previousActiveIndex = useRef<number | null>(null);
  const diceTimeoutRef = useRef<number | null>(null);
  const [lastMoveResult, setLastMoveResult] = useState<MoveResult | null>(null);

  const start = useCallback((setup: GameSetup) => {
    const startedAt = Date.now();
    latestSetup.current = { ...setup, now: startedAt };
    previousActiveIndex.current = 0;
    setNow(startedAt);
    setHandoffPlayerName(null);
    setIsDiceRolling(false);
    setGame(createGame({ ...setup, now: startedAt }));
  }, []);

  const restart = useCallback(() => {
    if (latestSetup.current) start(latestSetup.current);
  }, [start]);

  const leave = useCallback(() => {
    latestSetup.current = null;
    previousActiveIndex.current = null;
    setHandoffPlayerName(null);
    setIsDiceRolling(false);
    setGame(null);
  }, []);

  const roll = useCallback(() => {
    if (isDiceRolling) return;
    const current = game;
    if (!current || current.phase !== "rolling" || handoffPlayerName) return;

    setIsDiceRolling(true);
    diceTimeoutRef.current = window.setTimeout(() => {
      setGame((previous) => {
        if (!previous || previous.phase !== "rolling") return previous;
        return rollDice(previous, rollLocalDice(), Date.now());
      });
      setIsDiceRolling(false);
    }, 560);
  }, [game, handoffPlayerName, isDiceRolling]);

  const move = useCallback((tokenIndex: number) => {
    if (handoffPlayerName) return;
    setGame((previous) => {
      if (!previous || previous.phase !== "moving") return previous;
      const result = moveToken(previous, tokenIndex, Date.now());
      setLastMoveResult(result);
      return result.state;
    });
  }, [handoffPlayerName]);

  const dismissHandoff = useCallback(() => setHandoffPlayerName(null), []);

  const skipTurn = useCallback(() => {
    setGame((previous) => (previous ? forfeitTurn(previous, Date.now(), "manual") : previous));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!game || game.mode !== "pass") return;
    if (previousActiveIndex.current === null) {
      previousActiveIndex.current = game.activePlayerIndex;
      return;
    }
    if (previousActiveIndex.current !== game.activePlayerIndex && game.phase === "rolling") {
      previousActiveIndex.current = game.activePlayerIndex;
      setHandoffPlayerName(getActivePlayer(game).name);
    }
  }, [game]);

  useEffect(() => {
    if (!game || game.phase === "finished" || handoffPlayerName) return;
    if (now < game.turnEndsAt) return;

    setGame((previous) => {
      if (!previous || previous.phase === "finished" || Date.now() < previous.turnEndsAt) return previous;
      return forfeitTurn(previous, Date.now(), "timeout");
    });
  }, [game, handoffPlayerName, now]);

  useEffect(() => {
    if (!game || game.phase === "finished" || handoffPlayerName) return;
    const active = getActivePlayer(game);
    if (!active.isBot) return;

    const delay = game.phase === "rolling" ? 720 : 580;
    const timeout = window.setTimeout(() => {
      if (game.phase === "rolling") {
        roll();
        return;
      }
      if (game.phase === "moving") {
        const tokenIndex = chooseBotMove(game);
        if (tokenIndex !== null) move(tokenIndex);
      }
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [game, handoffPlayerName, move, roll]);

  useEffect(() => {
    return () => {
      if (diceTimeoutRef.current !== null) window.clearTimeout(diceTimeoutRef.current);
    };
  }, []);

  return {
    game,
    now,
    isDiceRolling,
    handoffPlayerName,
    start,
    restart,
    leave,
    roll,
    move,
    dismissHandoff,
    skipTurn,
    lastMoveResult,
  };
};
