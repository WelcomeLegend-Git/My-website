import { useCallback, useEffect, useRef, useState } from "react";

import type { LudoGameState } from "../game/types";
import { PeerLudoGuest, PeerLudoHost, type HostLobbyPlayer, type PeerRole } from "../online/peerRoom";

export type PeerStatus = "idle" | "connecting" | "lobby" | "playing" | "closed";

export interface PeerLudoController {
  role: PeerRole | null;
  status: PeerStatus;
  lobbyPlayers: HostLobbyPlayer[];
  game: LudoGameState | null;
  notice: string | null;
  error: string | null;
  mySeatKey: string | null;
  hostRoom: (roomCode: string, hostName: string) => void;
  joinRoom: (roomCode: string, guestName: string) => void;
  addBot: () => void;
  removeSeat: (seatKey: string) => void;
  startMatch: () => void;
  restartMatch: () => void;
  roll: () => void;
  move: (tokenIndex: number) => void;
  forfeit: () => void;
  leave: () => void;
}

export const usePeerLudo = (): PeerLudoController => {
  const [role, setRole] = useState<PeerRole | null>(null);
  const [status, setStatus] = useState<PeerStatus>("idle");
  const [lobbyPlayers, setLobbyPlayers] = useState<HostLobbyPlayer[]>([]);
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mySeatKey, setMySeatKey] = useState<string | null>(null);

  const hostRef = useRef<PeerLudoHost | null>(null);
  const guestRef = useRef<PeerLudoGuest | null>(null);

  const hostRoom = useCallback((roomCode: string, hostName: string) => {
    guestRef.current?.close();
    guestRef.current = null;
    hostRef.current?.close();
    const host = new PeerLudoHost(roomCode, hostName);
    hostRef.current = host;
    setRole("host");
    setStatus("connecting");
    setError(null);
    setNotice("Opening the room…");
    setMySeatKey("host-seat");
    setLobbyPlayers(host.players);
    host.onLobby = (players) => {
      setLobbyPlayers(players);
      setStatus((current) => {
        if (current === "connecting") setNotice(null);
        return current === "playing" ? current : "lobby";
      });
    };
    host.onState = (state) => {
      setGame(state);
      setStatus("playing");
    };
    host.onNotice = (text) => setNotice(text);
    host.onError = (text) => setError(text);
    host.open();
  }, []);

  const joinRoom = useCallback((roomCode: string, guestName: string) => {
    hostRef.current?.close();
    hostRef.current = null;
    guestRef.current?.close();
    const guest = new PeerLudoGuest(roomCode, guestName);
    guestRef.current = guest;
    setRole("guest");
    setStatus("connecting");
    setError(null);
    setNotice("Connecting to the room…");
    setGame(null);
    setMySeatKey(null);
    guest.onConnected = () => {
      setStatus("lobby");
      setNotice("Connected. Waiting for the host to start.");
    };
    guest.onLobby = (players, _hostName, code) => {
      setLobbyPlayers(players);
      setStatus((current) => (current === "playing" ? current : "lobby"));
      void code;
      const mine = players.find((player) => player.name.toLowerCase() === guestName.toLowerCase());
      if (mine) setMySeatKey(mine.seatKey);
    };
    guest.onState = (state) => {
      setGame(state);
      setStatus("playing");
    };
    guest.onNotice = (text) => setNotice(text);
    guest.onClosed = (text) => {
      setError(text);
      setStatus("closed");
    };
    guest.connect();
  }, []);

  const addBot = useCallback(() => hostRef.current?.addBot(), []);
  const removeSeat = useCallback((seatKey: string) => hostRef.current?.removeSeat(seatKey), []);
  const startMatch = useCallback(() => {
    const started = hostRef.current?.startMatch();
    if (!started) setNotice("Need at least 2 players to start.");
  }, []);

  const restartMatch = useCallback(() => {
    hostRef.current?.restartMatch();
  }, []);

  const roll = useCallback(() => {
    if (role === "host") hostRef.current?.hostRoll();
    else guestRef.current?.roll();
  }, [role]);

  const move = useCallback((tokenIndex: number) => {
    if (role === "host") hostRef.current?.hostMove(tokenIndex);
    else guestRef.current?.move(tokenIndex);
  }, [role]);

  const forfeit = useCallback(() => {
    if (role === "host") hostRef.current?.hostForfeit();
    else guestRef.current?.forfeit();
  }, [role]);

  const leave = useCallback(() => {
    hostRef.current?.close();
    guestRef.current?.close();
    hostRef.current = null;
    guestRef.current = null;
    setRole(null);
    setStatus("idle");
    setGame(null);
    setLobbyPlayers([]);
    setNotice(null);
    setError(null);
    setMySeatKey(null);
  }, []);

  useEffect(() => () => {
    hostRef.current?.close();
    guestRef.current?.close();
  }, []);

  return {
    role,
    status,
    lobbyPlayers,
    game,
    notice,
    error,
    mySeatKey,
    hostRoom,
    joinRoom,
    addBot,
    removeSeat,
    startMatch,
    restartMatch,
    roll,
    move,
    forfeit,
    leave,
  };
};
