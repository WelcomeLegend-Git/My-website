import { useCallback, useEffect, useRef, useState } from "react";
import type { LudoGameState } from "../game/types";
import { PeerLudoGuest, PeerLudoHost, type HostLobbyPlayer, type PeerRole, type PeerResume } from "../online/peerRoom";
import { parseRoomAdmission } from "../online/roomCode";

export type PeerStatus = "idle" | "connecting" | "lobby" | "playing" | "closed";
export interface PeerLudoController {
  role: PeerRole | null;
  status: PeerStatus;
  lobbyPlayers: HostLobbyPlayer[];
  game: LudoGameState | null;
  notice: string | null;
  error: string | null;
  mySeatKey: string | null;
  hostRoom: (roomCode: string, hostName: string, inviteSecret?: string) => void;
  joinRoom: (roomCodeOrLink: string, guestName: string, inviteSecret?: string) => void;
  reconnect: () => void;
  addBot: () => void;
  removeSeat: (seatKey: string) => void;
  startMatch: () => void;
  restartMatch: () => void;
  roll: () => void;
  move: (tokenIndex: number) => void;
  forfeit: () => void;
  leave: () => void;
}

type GuestSession = { roomCode: string; name: string; inviteSecret?: string; resume?: PeerResume };
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
  const sessionRef = useRef<GuestSession | null>(null);
  const generation = useRef(0);

  const dispose = useCallback((leaveGuest = false) => {
    ++generation.current;
    const host = hostRef.current;
    const guest = guestRef.current;
    hostRef.current = null;
    guestRef.current = null;
    host?.close();
    if (leaveGuest) guest?.leave(); else guest?.close();
  }, []);
  const reset = useCallback((nextRole: PeerRole) => {
    setRole(nextRole);
    setStatus("connecting");
    setError(null);
    setNotice("Connecting to the room…");
    setGame(null);
    setLobbyPlayers([]);
    setMySeatKey(null);
  }, []);

  const hostRoom = useCallback((roomCode: string, hostName: string, inviteSecret?: string) => {
    dispose(true);
    sessionRef.current = null;
    reset("host");
    const epoch = generation.current;
    const current = (): boolean => epoch === generation.current;
    try {
      const host = new PeerLudoHost(roomCode, hostName, inviteSecret);
      hostRef.current = host;
      setMySeatKey("host-seat");
      setLobbyPlayers(host.players);
      host.onLobby = (players) => {
        if (!current()) return;
        setLobbyPlayers(players);
        setNotice(null);
        setStatus(host.state ? "playing" : "lobby");
        if (!host.state) setGame(null);
      };
      host.onState = (state) => { if (current()) { setGame(state); setStatus("playing"); } };
      host.onNotice = (text) => { if (current()) setNotice(text); };
      host.onError = (text) => { if (current()) { setError(text); setStatus("closed"); setNotice(null); } };
      host.onClosed = () => { if (current()) setStatus("closed"); };
      host.open();
    } catch (cause) {
      if (current()) { setError(cause instanceof Error ? cause.message : "Unable to open room."); setStatus("closed"); setNotice(null); }
    }
  }, [dispose, reset]);

  const joinRoom = useCallback((roomCodeOrLink: string, guestName: string, inviteSecret?: string) => {
    let admission: ReturnType<typeof parseRoomAdmission>;
    try { admission = parseRoomAdmission(roomCodeOrLink, inviteSecret); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid room invite."); return; }
    const previous = sessionRef.current;
    const sameRoom = previous?.roomCode === admission.roomCode && previous.inviteSecret === admission.inviteSecret;
    dispose(!sameRoom);
    reset("guest");
    const session: GuestSession = { ...admission, name: guestName, resume: sameRoom ? previous?.resume : undefined };
    sessionRef.current = session;
    const epoch = generation.current;
    const current = (): boolean => epoch === generation.current;
    try {
      const guest = new PeerLudoGuest(session.roomCode, guestName, session.inviteSecret, session.resume);
      guestRef.current = guest;
      guest.onAssigned = (identity) => {
        if (!current()) return;
        session.resume = identity;
        setMySeatKey(identity.seatKey);
      };
      guest.onConnected = () => { if (current()) { setStatus("lobby"); setNotice("Connected. Waiting for the host to start."); } };
      guest.onLobby = (players) => { if (current()) { setLobbyPlayers(players); setStatus((value) => value === "playing" ? value : "lobby"); } };
      guest.onState = (state) => { if (current()) { setGame(state); setStatus("playing"); setNotice(null); } };
      guest.onNotice = (text) => { if (current()) setNotice(text); };
      guest.onClosed = (text) => {
        if (!current()) return;
        // Transport failures retain resume eligibility; explicit rejection revokes it.
        session.resume = guest.resumeIdentity;
        if (!session.resume) setMySeatKey(null);
        setError(text); setStatus("closed"); setNotice(null);
      };
      guest.connect();
    } catch (cause) {
      if (current()) { setError(cause instanceof Error ? cause.message : "Unable to join room."); setStatus("closed"); setNotice(null); }
    }
  }, [dispose, reset]);
  const reconnect = useCallback(() => {
    const session = sessionRef.current;
    if (session) joinRoom(session.roomCode, session.name, session.inviteSecret);
  }, [joinRoom]);
  const addBot = useCallback(() => hostRef.current?.addBot(), []);
  const removeSeat = useCallback((key: string) => hostRef.current?.removeSeat(key), []);
  const startMatch = useCallback(() => {
    try { if (!hostRef.current?.startMatch()) setNotice("Need at least 2 players, with every human connected, to start."); }
    catch { setError("Unable to start the match. Secure randomness must be available."); }
  }, []);
  const restartMatch = useCallback(() => {
    try { hostRef.current?.restartMatch(); } catch { setError("Unable to restart the match."); }
  }, []);
  const roll = useCallback(() => { if (hostRef.current) hostRef.current.hostRoll(); else guestRef.current?.roll(); }, []);
  const move = useCallback((index: number) => { if (hostRef.current) hostRef.current.hostMove(index); else guestRef.current?.move(index); }, []);
  const forfeit = useCallback(() => { if (hostRef.current) hostRef.current.hostForfeit(); else guestRef.current?.forfeit(); }, []);
  const leave = useCallback(() => {
    dispose(true);
    sessionRef.current = null;
    setRole(null); setStatus("idle"); setGame(null); setLobbyPlayers([]); setNotice(null); setError(null); setMySeatKey(null);
  }, [dispose]);
  useEffect(() => () => { dispose(); sessionRef.current = null; }, [dispose]);
  return { role, status, lobbyPlayers, game, notice, error, mySeatKey, hostRoom, joinRoom, reconnect, addBot, removeSeat, startMatch, restartMatch, roll, move, forfeit, leave };
};
