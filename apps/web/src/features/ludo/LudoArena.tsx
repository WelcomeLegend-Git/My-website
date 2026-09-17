import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Bot,
  ChevronLeft,
  Copy,
  Crown,
  Dices,
  Gamepad2,
  Link2,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import { LudoSoundEngine } from "./audio/SoundEngine";
import { GameHud } from "./components/GameHud";
import { CornerPlayerStation } from "./components/CornerPlayerStation";
import { LudoBoard } from "./components/LudoBoard";
import { LudoDialog } from "./components/LudoDialog";
import { PassDeviceOverlay } from "./components/PassDeviceOverlay";
import { ParticleCanvas } from "./effects/ParticleCanvas";
import { useLudoReducedMotion } from "./effects/useLudoReducedMotion";
import { useParticles } from "./effects/useParticles";

import { COLOR_META } from "./game/board";
import { getActivePlayer } from "./game/engine";
import { PLAYER_COLORS, type GameMode, type LudoGameState, type LudoPlayer } from "./game/types";
import { useLudoGame } from "./hooks/useLudoGame";
import { usePeerLudo } from "./hooks/usePeerLudo";
import { createRoomLink, generateInviteSecret, generateRoomCode, normaliseRoomCode, parseRoomAdmission } from "./online/roomCode";
import "./ludo.css";

type LobbyView = "home" | "setup" | "online";

const defaultNames = ["You", "Player 2", "Player 3", "Player 4"];

const modeCards: Array<{
  mode: GameMode;
  title: string;
  description: string;
  icon: typeof Bot;
  accent: string;
  tag: string;
  badge?: string;
}> = [
  {
    mode: "single",
    title: "Solo Arena",
    description: "Challenge smart bots with a real turn clock and tactical moves.",
    icon: Bot,
    accent: "violet",
    tag: "VS AI",
    badge: "QUICK START",
  },
  {
    mode: "pass",
    title: "Pass & Play",
    description: "Gather around one screen and pass the device between turns.",
    icon: Users,
    accent: "mint",
    tag: "1 DEVICE",
  },
  {
    mode: "online",
    title: "Online Room",
    description: "Host a table in your browser and invite friends to join.",
    icon: Wifi,
    accent: "amber",
    tag: "FRIENDS",
  },
];

const compactName = (value: string, fallback: string): string => value.trim().slice(0, 16) || fallback;

const createPlayer = (colorIndex: number, name: string, isBot = false): LudoPlayer => ({
  id: `${isBot ? "bot" : "player"}-${PLAYER_COLORS[colorIndex]}-${name.toLowerCase().replace(/\s+/g, "-")}`,
  name,
  color: PLAYER_COLORS[colorIndex],
  isBot,
  connection: isBot ? "bot" : "ready",

  avatarSeed: `${colorIndex}-${name}`,
});

export interface LudoArenaProps {
  /** Lets the eventual page hand in a deep-linked room code. */
  initialRoomCode?: string;
}

export const LudoArena = (props: LudoArenaProps) => (
  <MotionConfig reducedMotion="user"><LudoArenaContent {...props} /></MotionConfig>
);

const LudoArenaContent = ({ initialRoomCode }: LudoArenaProps) => {
  const reducedMotion = useLudoReducedMotion();
  const controller = useLudoGame();
  const peer = usePeerLudo();
  const [view, setView] = useState<LobbyView>(initialRoomCode ? "online" : "home");
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialRoomCode ? "online" : "single");
  const [playerCount, setPlayerCount] = useState(2);
  const [botCount, setBotCount] = useState(1);
  const [playerNames, setPlayerNames] = useState(defaultNames);
  const [muted, setMuted] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [inviteSecret, setInviteSecret] = useState("");
  const [roomInput, setRoomInput] = useState(initialRoomCode ?? "");
  const [copied, setCopied] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);
  const [showSixBurst, setShowSixBurst] = useState(false);
  const [boardShaking, setBoardShaking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const transientTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const copyGeneration = useRef(0);
  const schedule = useCallback((callback: () => void, delay: number): void => {
    const timer = setTimeout(() => {
      transientTimers.current = transientTimers.current.filter((entry) => entry !== timer);
      callback();
    }, delay);
    transientTimers.current.push(timer);
  }, []);
  const clearTransients = (): void => {
    transientTimers.current.forEach(clearTimeout);
    transientTimers.current = [];
    copyGeneration.current += 1;
    setCopied(false);
    setShowSixBurst(false);
    setBoardShaking(false);
  };
  useEffect(() => () => {
    transientTimers.current.forEach(clearTimeout);
    copyGeneration.current += 1;
  }, []);

  // --- Sound engine (top-level, unconditional) ---
  const soundRef = useRef<LudoSoundEngine | null>(null);
  useEffect(() => {
    const engine = new LudoSoundEngine();
    soundRef.current = engine;
    const onVisibility = (): void => { if (document.hidden) engine.stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      soundRef.current = null;
    };
  }, []);
  useEffect(() => { if (soundRef.current) soundRef.current.muted = muted; }, [muted]);
  const unlockSound = (): void => { soundRef.current?.unlock(); };

  // --- Particle system (top-level, unconditional) ---
  const particles = useParticles();
  const effectGameRef = useRef<string | null>(null);
  const victoryRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevMoveFingerprintRef = useRef<string | null>(null);
  const turnRef = useRef<string | null>(null);
  const boardShellRef = useRef<HTMLDivElement>(null);

  const onlineGame = peer.game;
  const activeGame: LudoGameState | null = selectedMode === "online" ? onlineGame : controller.game;
  const isOnline = selectedMode === "online" && onlineGame !== null;
  const myTurn = isOnline
    ? peer.status === "playing" && getActivePlayer(onlineGame).id === (peer.role === "host" ? "host-seat" : peer.mySeatKey)
    : true;
  const reconnectControl = peer.status === "closed" && peer.role === "guest" ? (
    <div className="ludo-online-actions">
      <p className="ludo-online-safety">Connection lost. Reconnect within 90 seconds to reclaim your seat. Keep this tab open; refreshing clears recovery credentials.</p>
      <button type="button" className="ludo-secondary-button" onClick={peer.reconnect}><Wifi size={16} /> Reconnect</button>
    </div>
  ) : null;

  const activeRoomLink = useMemo(() => {
    if (!roomCode || !inviteSecret || typeof window === "undefined") return "";
    return createRoomLink(window.location.origin, roomCode, inviteSecret);
  }, [inviteSecret, roomCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathMatch = window.location.pathname.match(/\/ludo\/room\/(\d{5})$/i);
    const deepLinkedCode = initialRoomCode ?? pathMatch?.[1] ?? new URLSearchParams(window.location.search).get("room") ?? "";
    const deepLinkedSecret = new URLSearchParams(window.location.search).get("invite") ?? "";
    if (deepLinkedCode) {
      setRoomCode(normaliseRoomCode(deepLinkedCode));
      setRoomInput(normaliseRoomCode(deepLinkedCode));
      setInviteSecret(deepLinkedSecret);
      setView("online");
      setSelectedMode("online");
      setOnlineNotice("Invite detected. Add your name, then join the room.");
    }
  }, [initialRoomCode]);

  // --- Sound & particle effects (dice) ---
  useEffect(() => {
    const state = activeGame;
    if (effectGameRef.current !== (state?.id ?? null)) {
      effectGameRef.current = state?.id ?? null;
      prevPhaseRef.current = null;
      prevMoveFingerprintRef.current = null;
      victoryRef.current = null;
      turnRef.current = null;
    }
    if (!state) return;
    if (state.diceValue !== null && state.phase !== "rolling" && prevPhaseRef.current === "rolling") {
      soundRef.current?.diceRoll();
      if (state.diceValue === 6) {
        soundRef.current?.sixRoll();
        if (!reducedMotion) {
          setShowSixBurst(true);
          schedule(() => setShowSixBurst(false), 700);
        }
        const shell = boardShellRef.current;
        if (shell) {
          const rect = shell.getBoundingClientRect();
          particles.emit("six", { x: rect.width * 0.85, y: rect.height * 0.08 });
        }
      }
    }

    prevPhaseRef.current = state.phase;
  }, [activeGame, particles, reducedMotion, schedule]);

  // --- Sound & particle effects (moves, captures, finishes) ---
  useEffect(() => {
    const state = activeGame;
    if (!state?.lastMove) return;
    const move = state.lastMove;
    const moveEvent = [...state.moveLog].reverse().find((entry) => entry.kind === "move" || entry.kind === "capture" || entry.kind === "finish");
        const fingerprint = `${state.id}-${moveEvent?.id ?? ""}-${move.playerColor}-${move.tokenIndex}-${move.from}-${move.to}`;
    if (fingerprint === prevMoveFingerprintRef.current) return;
    prevMoveFingerprintRef.current = fingerprint;

    soundRef.current?.tokenMove();

    if (move.captured.length > 0) {
      soundRef.current?.tokenCapture();
      if (!reducedMotion) {
        setBoardShaking(true);
        schedule(() => setBoardShaking(false), 400);
      }
      const shell = boardShellRef.current;
      if (shell) {
        const rect = shell.getBoundingClientRect();
        particles.emit("capture", { x: rect.width / 2, y: rect.height / 2 }, move.captured[0].color);
      }
    }

    if (move.finished) {
      soundRef.current?.tokenFinish();
      const shell = boardShellRef.current;
      if (shell) {
        const rect = shell.getBoundingClientRect();
        particles.emit("finishToken", { x: rect.width / 2, y: rect.height / 2 }, move.playerColor);
      }
    }
  }, [activeGame, particles, reducedMotion, schedule]);

  useEffect(() => {
    const state = activeGame;
    if (!state || state.phase !== "finished") {
      victoryRef.current = null;
      return;
    }
    if (victoryRef.current === state.id) return;
    victoryRef.current = state.id;
    soundRef.current?.victory();
    const shell = boardShellRef.current;
    if (shell) {
      const rect = shell.getBoundingClientRect();
      particles.emit("victory", { x: rect.width / 2, y: 0 });
    }
  }, [activeGame, activeGame?.phase, particles]);

  useEffect(() => {
    const state = activeGame;
    if (!state || state.phase !== "rolling" || state.revision <= 1) return;
    const key = `${state.id}-${state.activePlayerIndex}-${state.turnStartedAt}`;
    if (turnRef.current === key) return;
    turnRef.current = key;
    soundRef.current?.turnChime();
  }, [activeGame, activeGame?.activePlayerIndex, activeGame?.phase, activeGame?.revision]);

  // Auto-play move when exactly 1 legal move exists (standard Ludo King quality-of-life)
  useEffect(() => {
    const state = activeGame;
    if (!state || state.phase !== "moving") return;
    if (state.legalTokenIndexes.length !== 1) return;
    const active = getActivePlayer(state);
    if (!isOnline && active.isBot) return;
    if (isOnline && !myTurn) return;
    if (!isOnline && controller.handoffPlayerName) return;

    const onlyTokenIndex = state.legalTokenIndexes[0];
    const timer = setTimeout(() => {
      if (isOnline) {
        peer.move(onlyTokenIndex);
      } else {
        controller.move(onlyTokenIndex);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    activeGame?.phase,
    activeGame?.diceValue,
    activeGame?.legalTokenIndexes,
    activeGame?.revision,
    isOnline,
    myTurn,
    controller.handoffPlayerName,
  ]);
  const updateName = (index: number, value: string): void => {
    setPlayerNames((names) => names.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  const openMode = (mode: GameMode): void => {
    clearTransients();
    controller.leave();
    peer.leave();
    setOnlineNotice(null);
    setSelectedMode(mode);
    setView(mode === "online" ? "online" : "setup");
  };

  const startLocalMatch = (mode: "single" | "pass"): void => {
    clearTransients();
    peer.leave();
    const ownName = compactName(playerNames[0], "You");
      const players = mode === "single"
        ? [
            createPlayer(0, ownName),
            ...Array.from({ length: botCount }, (_, index) => createPlayer(index + 1, ["Nova", "Atlas", "Mira"][index], true)),
          ]
        : Array.from({ length: playerCount }, (_, index) =>
            createPlayer(index, compactName(playerNames[index], `Player ${index + 1}`)),
          );

      controller.start({
        mode,
        players,
        rules: { turnDurationSeconds: 0, rankedFinish: true, blockadesEnabled: false },
      });

  };

  const createRoom = (): void => {
    try {
      const code = generateRoomCode();
      const secret = generateInviteSecret();
      clearTransients();
      setRoomCode(code);
      setRoomInput(code);
      setInviteSecret(secret);
      setOnlineNotice("Private room generated, not reserved. Open it, then share the full invite link; the number alone cannot admit guests.");
    } catch {
      setOnlineNotice("Private rooms require secure randomness. Use a supported browser over HTTPS or localhost.");
    }
  };

  const openRoom = (): void => {
    if (normaliseRoomCode(roomCode).length !== 5) return;
    controller.leave();
    setSelectedMode("online");
    copyGeneration.current += 1;
    const name = compactName(playerNames[0], "Host");
    peer.hostRoom(roomCode, name, inviteSecret || undefined);
    setOnlineNotice(null);
  };

  const joinRoom = (): void => {
    if (!compactName(playerNames[0], "")) {
      setOnlineNotice("Enter your name before joining.");
      return;
    }
    let admission: ReturnType<typeof parseRoomAdmission>;
    try {
      admission = parseRoomAdmission(roomInput, inviteSecret || undefined);
    } catch (cause) {
      setOnlineNotice(cause instanceof Error ? cause.message : "Enter a room number or full invite link.");
      return;
    }
    controller.leave();
    setSelectedMode("online");
    setRoomCode(admission.roomCode);
    setRoomInput(admission.roomCode);
    setInviteSecret(admission.inviteSecret ?? "");
    setOnlineNotice(null);
    peer.joinRoom(admission.roomCode, compactName(playerNames[0], "Guest"), admission.inviteSecret);
  };

  const copyInvite = async (): Promise<void> => {
    if (!activeRoomLink) return;
    const generation = ++copyGeneration.current;
    try {
      await navigator.clipboard.writeText(activeRoomLink);
      if (generation !== copyGeneration.current) return;
      setCopied(true);
      schedule(() => { if (generation === copyGeneration.current) setCopied(false); }, 1_900);
    } catch {
      if (generation === copyGeneration.current) setOnlineNotice("Select and copy the full invite link shown above.");
    }
  };

  const leaveMatch = (): void => {
    clearTransients();
    particles.clear();
    soundRef.current?.stop();
    peer.leave();
    controller.leave();
    setConfirmLeave(false);
    setOnlineNotice(null);
    setRoomCode("");
    setRoomInput("");
    setInviteSecret("");
    setView("home");
  };
  const toggleSound = (): void => {
    const nextMuted = !muted;
    if (soundRef.current) {
      soundRef.current.muted = nextMuted;
      if (!nextMuted) soundRef.current.unlock();
    }
    setMuted(nextMuted);
  };

  if (activeGame) {
    const state = activeGame;
    const winnerColor = state.winnerOrder[0];
    const winner = winnerColor ? state.players.find((player) => player.color === winnerColor) : null;
    const active = getActivePlayer(state);
    const isDiceRolling = controller.isDiceRolling && !isOnline;
    const interactionLocked = (isOnline && !myTurn) || Boolean(controller.handoffPlayerName) || (!isOnline && active.isBot);
    const canRoll = state.phase === "rolling" && !interactionLocked && !isDiceRolling;
    const redPlayer = state.players.find((p) => p.color === "red");
    const bluePlayer = state.players.find((p) => p.color === "blue");
    const greenPlayer = state.players.find((p) => p.color === "green");
    const yellowPlayer = state.players.find((p) => p.color === "yellow");

    return (
      <main className="ludo-arena" onClickCapture={unlockSound}>
        <div className="ludo-stars" aria-hidden="true" />
        <div className="ludo-game-stage">
          <GameHud
            state={state}
            now={controller.now}
            isDiceRolling={isDiceRolling}
            muted={muted}
            onRoll={isOnline ? peer.roll : controller.roll}
            onLeave={() => setConfirmLeave(true)}
            onSkipTurn={isOnline ? peer.forfeit : controller.skipTurn}
            onToggleMute={toggleSound}
            interactionLocked={interactionLocked}
          />

          {isOnline && (peer.error || peer.notice) && (
            <p className={peer.error ? "ludo-online-error" : "ludo-online-notice"} role={peer.error ? "alert" : "status"}>
              <Wifi size={16} /> {peer.error ?? peer.notice}
            </p>
          )}
          {reconnectControl}
          <div className="ludo-board-layout">
            <aside className="ludo-match-feed" aria-label="Match activity">
              <div className="ludo-feed-heading"><Sparkles size={15} /> Match feed</div>
              <div className="ludo-feed-list">
                {[...state.moveLog].reverse().slice(0, 6).map((entry) => (
                  <p className={`ludo-feed-item is-${entry.kind}`} key={entry.id}>
                    <i style={{ background: COLOR_META[entry.playerColor].color }} />{entry.text}
                  </p>
                ))}
              </div>
              <div className="ludo-rules-mini">
                <ShieldCheck size={15} />
                <span>Safe stars · exact finish · three sixes lose a turn</span>
              </div>
            </aside>

            <div className="ludo-board-column">
              <div className="ludo-board-frame">
                {/* Top Stations: Red (top-left) & Blue (top-right) */}
                <div className="ludo-stations-row ludo-stations-top">
                  {redPlayer ? (
                    <CornerPlayerStation
                      player={redPlayer}
                      state={state}
                      isActive={active.color === "red" && state.phase !== "finished"}
                      isDiceRolling={isDiceRolling}
                      canRoll={canRoll && active.color === "red"}
                      onRoll={isOnline ? peer.roll : controller.roll}
                      corner="top-left"
                      interactionLocked={interactionLocked}
                    />
                  ) : <div className="ludo-corner-station-placeholder" />}

                  {bluePlayer ? (
                    <CornerPlayerStation
                      player={bluePlayer}
                      state={state}
                      isActive={active.color === "blue" && state.phase !== "finished"}
                      isDiceRolling={isDiceRolling}
                      canRoll={canRoll && active.color === "blue"}
                      onRoll={isOnline ? peer.roll : controller.roll}
                      corner="top-right"
                      interactionLocked={interactionLocked}
                    />
                  ) : <div className="ludo-corner-station-placeholder" />}
                </div>

                {/* Central Board */}
                <div ref={boardShellRef} className="ludo-board-effects">
                  <LudoBoard
                    state={state}
                    onTokenSelect={isOnline ? peer.move : controller.move}
                    interactionDisabled={interactionLocked}
                    boardShaking={boardShaking && !reducedMotion}
                  />
                  <ParticleCanvas bindCanvas={particles.bindCanvas} />
                  {showSixBurst && !reducedMotion && <div className="ludo-six-burst" aria-hidden="true">SIX!</div>}
                </div>

                {/* Bottom Stations: Green (bottom-left) & Yellow (bottom-right) */}
                <div className="ludo-stations-row ludo-stations-bottom">
                  {greenPlayer ? (
                    <CornerPlayerStation
                      player={greenPlayer}
                      state={state}
                      isActive={active.color === "green" && state.phase !== "finished"}
                      isDiceRolling={isDiceRolling}
                      canRoll={canRoll && active.color === "green"}
                      onRoll={isOnline ? peer.roll : controller.roll}
                      corner="bottom-left"
                      interactionLocked={interactionLocked}
                    />
                  ) : <div className="ludo-corner-station-placeholder" />}

                  {yellowPlayer ? (
                    <CornerPlayerStation
                      player={yellowPlayer}
                      state={state}
                      isActive={active.color === "yellow" && state.phase !== "finished"}
                      isDiceRolling={isDiceRolling}
                      canRoll={canRoll && active.color === "yellow"}
                      onRoll={isOnline ? peer.roll : controller.roll}
                      corner="bottom-right"
                      interactionLocked={interactionLocked}
                    />
                  ) : <div className="ludo-corner-station-placeholder" />}
                </div>
              </div>
            <div className="ludo-board-controls" aria-label="Token moves">
              <p>{state.phase === "moving" && myTurn && !active.isBot ? "Choose a numbered token to move" : "Roll a six to leave the yard. Land exactly to reach home."}</p>
              {state.phase === "moving" && myTurn && !active.isBot && !controller.handoffPlayerName && (
                <div className="ludo-token-choices">
                  {state.legalTokenIndexes.map((index) => (
                    <button type="button" key={index} className="ludo-secondary-button" onClick={() => (isOnline ? peer.move : controller.move)(index)} aria-label={`Move ${COLOR_META[active.color].label} token ${index + 1}`}>
                      Token {index + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {!isOnline && state.phase !== "finished" && controller.handoffPlayerName && (
            <PassDeviceOverlay playerName={controller.handoffPlayerName} onReady={controller.dismissHandoff} />
          )}
          {state.phase === "finished" && (
            <LudoDialog title={winner?.name ?? "Match complete"} eyebrow="Champion" onClose={leaveMatch} decoration={<span className="ludo-result-crown"><Crown size={34} /></span>}>
                <p>{winner ? `All four ${COLOR_META[winner.color].label} tokens reached home first.` : "Thanks for playing."}</p>
                {state.winnerOrder.length > 0 && (
                  <ol className="ludo-result-standings">
                    {state.winnerOrder.map((color, index) => {
                      const ranked = state.players.find((player) => player.color === color);
                      if (!ranked) return null;
                      return (
                        <li key={color}>
                          <span className="ludo-result-rank">#{index + 1}</span>
                          <i style={{ background: COLOR_META[color].color }} />
                          {ranked.name}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="ludo-result-actions">
                  {(!isOnline || peer.role === "host") && (
                    <button
                      data-autofocus
                      type="button"
                      className="ludo-primary-button"
                      disabled={isOnline && peer.status !== "playing"}
                      onClick={() => {
                        clearTransients(); particles.clear(); soundRef.current?.stop();
                        // Reset effect fingerprints only when the game actually transitions.
                        if (isOnline) peer.restartMatch(); else controller.restart();
                      }}
                    >
                      <Play size={17} /> {isOnline ? "Rematch" : "Play again"}
                    </button>
                  )}
                  <button data-autofocus={isOnline && peer.role !== "host" ? true : undefined} type="button" className="ludo-secondary-button" onClick={leaveMatch}>Back to game modes</button>
                </div>
                {isOnline && peer.role !== "host" && <p className="ludo-rematch-note">The host can start a rematch. Stay here to play again.</p>}
                {reconnectControl}
            </LudoDialog>
          )}
        </AnimatePresence>
        {confirmLeave && state.phase !== "finished" && (
          <LudoDialog title="Leave this match?" onClose={() => setConfirmLeave(false)}>
            <p>{isOnline ? "Leaving disconnects your seat. If you are hosting, the room depends on your connection." : "Your current match will be cleared. You can start a new table anytime."}</p>
            <div className="ludo-result-actions">
              <button data-autofocus type="button" className="ludo-primary-button" onClick={() => setConfirmLeave(false)}>Keep playing</button>
              <button type="button" className="ludo-secondary-button" onClick={leaveMatch}>Leave match</button>
            </div>
          </LudoDialog>
        )}
      </main>
    );
  }

  if (peer.status === "connecting" || peer.status === "lobby") {
    const isHost = peer.role === "host";
    const allPlayersReady = peer.lobbyPlayers.every((seat) => seat.isBot || seat.connection === "ready");
    const canStart = isHost && peer.lobbyPlayers.length >= 2 && allPlayersReady;
    return (
      <main className="ludo-arena ludo-lobby" onClickCapture={unlockSound}>
        <div className="ludo-stars" aria-hidden="true" />
        <section className="ludo-lobby-shell">
          <header className="ludo-lobby-header">
            <button type="button" className="ludo-back-link" onClick={() => { leaveMatch(); setSelectedMode("online"); setView("online"); }}>
              <ChevronLeft size={18} /> Room setup
            </button>
            <span className="ludo-lobby-availability" role="status"><span /> ROOM {peer.status === "connecting" ? "OPENING" : "LIVE"}</span>
          </header>

          <motion.section className="ludo-online-card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : undefined}>
            <div className="ludo-setup-topline">
              <span className="ludo-mode-icon is-amber"><Wifi size={23} /></span>
              <div>
                <span className="ludo-eyebrow">ONLINE ROOM</span>
                <h2>{peer.status === "connecting" ? "Opening the room…" : `Room ${peer.status === "lobby" && isHost ? roomCode : "joined"}`}</h2>
              </div>
            </div>

            <p className="ludo-online-safety">Keep the host’s tab open. This is a peer-hosted room, not a server-refereed match; some networks may not connect.</p>
            {peer.status === "connecting" && (
              <p className="ludo-online-notice"><Sparkles size={15} /> {peer.notice ?? "Establishing a direct peer connection…"}</p>
            )}

            {peer.status === "lobby" && (
              <>
                <div className="ludo-room-created">
                  <span className="ludo-room-label">ROOM NUMBER</span>
                  <strong>{roomCode}</strong>
                  {activeRoomLink && (
                    <>
                      <code>{activeRoomLink}</code>
                      <button type="button" className="ludo-copy-link" onClick={copyInvite}><Copy size={15} /> {copied ? "Copied" : "Copy invite link"}</button>
                    </>
                  )}
                </div>

                <div className="ludo-lobby-players">
                  {peer.lobbyPlayers.map((seat) => (
                    <article className="ludo-lobby-player" key={seat.seatKey} style={{ "--player-colour": COLOR_META[seat.color].color } as React.CSSProperties}>
                      <span className="ludo-player-orb">{seat.isBot ? <Bot size={15} /> : seat.name.slice(0, 1).toUpperCase()}</span>
                      <span className="ludo-lobby-player-name">
                        <strong>{seat.name}{seat.seatKey === "host-seat" ? <Crown size={12} /> : null}</strong>
                        <small>{seat.seatKey === "host-seat" ? "HOST" : seat.isBot ? "BOT" : seat.connection === "offline" ? "OFFLINE" : "READY"}</small>
                      </span>
                      <i className="ludo-lobby-player-dot" />
                      {isHost && !seat.isBot && seat.seatKey !== "host-seat" && (
                        <button type="button" className="ludo-lobby-kick" onClick={() => peer.removeSeat(seat.seatKey)} aria-label={`Remove ${seat.name}`}>
                          <X size={14} />
                        </button>
                      )}
                    </article>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - peer.lobbyPlayers.length) }, (_, index) => (
                    <article className="ludo-lobby-player is-empty" key={`empty-${index}`}>
                      <span className="ludo-player-orb">?</span>
                      <span className="ludo-lobby-player-name"><strong>Waiting…</strong><small>SHARE THE INVITE LINK</small></span>
                    </article>
                  ))}
                </div>

                {(onlineNotice || peer.notice) && <p className="ludo-online-notice" role="status"><Sparkles size={15} /> {onlineNotice ?? peer.notice}</p>}

                {isHost ? (
                  <div className="ludo-online-actions">
                    <button type="button" className="ludo-secondary-button" onClick={peer.addBot} disabled={peer.lobbyPlayers.length >= 4}>
                      <UserPlus size={17} /> Fill with a bot
                    </button>
                    <button type="button" className="ludo-primary-button ludo-full-button" onClick={peer.startMatch} disabled={!canStart}>
                      <Play size={18} /> {canStart ? "Start match" : !allPlayersReady ? "Waiting for players to reconnect" : "Need at least 2 players"}
                    </button>
                  </div>
                ) : (
                  <p className="ludo-online-notice"><Sparkles size={15} /> You are seated and ready. The host starts the match.</p>
                )}
              </>
            )}
          </motion.section>
        </section>
      </main>
    );
  }

  return (
    <main className="ludo-arena ludo-lobby" onClickCapture={unlockSound}>
      <div className="ludo-stars" aria-hidden="true" />
      <section className="ludo-lobby-shell">
        <header className="ludo-lobby-header">
          {view !== "home" ? (
            <button type="button" className="ludo-back-link" onClick={leaveMatch}><ChevronLeft size={18} /> Game modes</button>
          ) : <span className="ludo-lobby-availability"><Dices size={16} /> LUDO / YOUR TABLE</span>}
          <button type="button" className="ludo-help-link" onClick={() => setShowRules(true)}><ShieldCheck size={16} /> How to play</button>
        </header>

        {view === "home" && (
          <>
            <div className="ludo-hero">
              <motion.div className="ludo-hero-dice ludo-hero-dice-one" animate={reducedMotion ? { y: 0, rotate: -8 } : { y: [0, -12, 0], rotate: [-8, 6, -8] }} transition={reducedMotion ? { duration: 0 } : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </motion.div>
              <motion.div className="ludo-hero-dice ludo-hero-dice-two" animate={reducedMotion ? { y: 0, rotate: 12 } : { y: [0, 10, 0], rotate: [12, -4, 12] }} transition={reducedMotion ? { duration: 0 } : { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </motion.div>
              <motion.div className="ludo-hero-orb" aria-hidden="true" animate={reducedMotion ? { y: 0, rotate: 0 } : { y: [0, -8, 0], rotate: [0, 3, 0] }} transition={reducedMotion ? { duration: 0 } : { duration: 4, repeat: Infinity }}>
                <span className="ludo-hero-orb-face is-a" /><span className="ludo-hero-orb-face is-b" /><span className="ludo-hero-orb-face is-c" /><span className="ludo-hero-orb-face is-d" />
              </motion.div>
              <span className="ludo-eyebrow">FOUR COLOURS. ONE GREAT GAME.</span>
              <h1>Roll bold.<br /><em>Play brilliant.</em></h1>
              <p>A little luck. A clever move. Race your tokens home, solo or with your favourite people.</p>
            </div>
            <div className="ludo-mode-grid">
              {modeCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.button
                    type="button"
                    className={`ludo-mode-card is-${card.accent}`}
                    key={card.mode}
                    onClick={() => openMode(card.mode)}
                    initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: index * 0.09 }}
                    whileHover={reducedMotion ? undefined : { y: -6, transition: { duration: 0.18 } }}
                    whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                  >
                    <span className="ludo-mode-icon"><Icon size={26} /></span>
                    {card.badge && <span className="ludo-mode-badge">{card.badge}</span>}
                    <span className="ludo-mode-tag">{card.tag}</span>
                    <strong>{card.title}</strong>
                    <small>{card.description}</small>
                    <span className="ludo-mode-arrow">→</span>
                  </motion.button>
                );
              })}
            </div>
            <footer className="ludo-lobby-footer">
              <span><Dices size={16} /> Classic rules, modern play</span>
              <span><Gamepad2 size={16} /> Phone · tablet · desktop</span>
              <span><Link2 size={16} /> Peer-hosted friend rooms</span>
            </footer>
          </>
        )}

        {view === "setup" && (
          <motion.section className="ludo-setup-card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : undefined}>
            <div className="ludo-setup-topline">
              <span className={`ludo-mode-icon is-${selectedMode === "single" ? "violet" : "mint"}`}>{selectedMode === "single" ? <Bot size={23} /> : <Users size={23} />}</span>
              <div>
                <span className="ludo-eyebrow">{selectedMode === "single" ? "SOLO ARENA" : "PASS & PLAY"}</span>
                <h2>{selectedMode === "single" ? "Build your bot table" : "Set up your table"}</h2>
              </div>
            </div>

            <label className="ludo-field-label">Your display name
              <input value={playerNames[0]} onChange={(event) => updateName(0, event.target.value)} maxLength={16} placeholder="Your name" />
            </label>

            {selectedMode === "single" ? (
              <div className="ludo-choice-group">
                <span className="ludo-field-label">Choose opponents</span>
                <div className="ludo-segmented-control" role="group" aria-label="Number of bot opponents">
                  {[1, 2, 3].map((value) => <button type="button" key={value} aria-pressed={botCount === value} className={botCount === value ? "is-selected" : ""} onClick={() => setBotCount(value)}>{value} bot{value > 1 ? "s" : ""}</button>)}
                </div>
              </div>
            ) : (
              <>
                <div className="ludo-choice-group">
                  <span className="ludo-field-label">Players at this device</span>
                  <div className="ludo-segmented-control" role="group" aria-label="Number of players">
                    {[2, 3, 4].map((value) => <button type="button" key={value} aria-pressed={playerCount === value} className={playerCount === value ? "is-selected" : ""} onClick={() => setPlayerCount(value)}>{value} players</button>)}
                  </div>
                </div>
                <div className="ludo-player-name-list">
                  {Array.from({ length: playerCount - 1 }, (_, index) => (
                    <label className="ludo-field-label" key={index}>Player {index + 2}
                      <input value={playerNames[index + 1]} onChange={(event) => updateName(index + 1, event.target.value)} maxLength={16} placeholder={`Player ${index + 2}`} />
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="ludo-rule-preview"><ShieldCheck size={17} /> 30-second turns · safe stars · exact finish · three sixes lose a turn</div>
            <button type="button" className="ludo-primary-button ludo-full-button" onClick={() => startLocalMatch(selectedMode === "single" ? "single" : "pass")}>
              <Play size={18} /> Start game
            </button>
          </motion.section>
        )}

        {view === "online" && (
          <motion.section className="ludo-online-card" initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : undefined}>
            <div className="ludo-setup-topline">
              <span className="ludo-mode-icon is-amber"><Wifi size={23} /></span>
              <div>
                <span className="ludo-eyebrow">ONLINE ROOM</span>
                <h2>Bring your friends in</h2>
              </div>
            </div>
            <label className="ludo-field-label">Your name
              <input value={playerNames[0]} onChange={(event) => updateName(0, event.target.value)} maxLength={16} placeholder="Choose a name" />
            </label>

            <div className="ludo-online-actions">
              <button type="button" className="ludo-create-room" onClick={createRoom} disabled={!compactName(playerNames[0], "")}><Plus size={18} /> Create a new room</button>
              <div className="ludo-join-row">
                <input maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false} value={roomInput} onKeyDown={(event) => { if (event.key === "Enter") joinRoom(); }} onChange={(event) => { const value = event.target.value; setRoomInput(value); setRoomCode(/^\d{5}$/.test(value) ? value : ""); setInviteSecret(""); setCopied(false); copyGeneration.current += 1; }} placeholder="Room number or full invite link" aria-label="Room number or invite link" aria-describedby="ludo-invite-help" />
                <button type="button" className="ludo-secondary-button" onClick={joinRoom} disabled={!compactName(playerNames[0], "")}>Join</button>
              </div>
            </div>

            <p id="ludo-invite-help" className="ludo-online-safety">Private rooms need the full invite link. A number alone only joins code-only rooms.</p>

            {roomCode && (
              <div className="ludo-room-created">
                <span className="ludo-room-label">ROOM NUMBER</span>
                <strong>{roomCode}</strong>
                {activeRoomLink ? (
                  <>
                    <code>{activeRoomLink}</code>
                    <button type="button" className="ludo-copy-link" onClick={copyInvite}><Copy size={15} /> {copied ? "Copied" : "Copy invite link"}</button>
                  </>
                ) : <p>Join this room, or generate a new number to host.</p>}
              </div>
            )}

            {onlineNotice && <p className="ludo-online-notice" role="status"><Sparkles size={15} /> {onlineNotice}</p>}

            <div className="ludo-online-safety"><ShieldCheck size={16} /> The host’s browser runs the match and must stay open. No independent server referee. Disconnected seats are reserved for 90 seconds; refreshing clears recovery credentials. Some networks may not connect.</div>
            <button type="button" className="ludo-primary-button ludo-full-button" onClick={openRoom} disabled={normaliseRoomCode(roomCode).length !== 5 || !compactName(playerNames[0], "")}>
              <Play size={18} /> Open room & go live
            </button>
            {peer.error && <p className="ludo-online-error" role="alert"><X size={15} /> {peer.error}</p>}
            {reconnectControl}
          </motion.section>
        )}
      </section>

      {showRules && (
        <LudoDialog title="Race all four tokens home" eyebrow="How to play" onClose={() => setShowRules(false)}>
          <ol className="ludo-rules-list">
            <li>Roll a six to leave your yard. A six earns another roll; three in a row lose the turn.</li>
            <li>Choose a highlighted token. Stars are safe; elsewhere you can send an opponent back to their yard.</li>
            <li>Stars and start squares protect tokens from capture. You need an exact roll to finish.</li>
            <li>Each turn has 30 seconds. In Pass & Play, hand over the device when prompted.</li>
          </ol>
          <button data-autofocus type="button" className="ludo-primary-button ludo-full-button" onClick={() => setShowRules(false)}>Got it — let’s play</button>
        </LudoDialog>
      )}
    </main>
  );
};
