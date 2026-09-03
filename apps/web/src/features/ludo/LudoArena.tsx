import { AnimatePresence, motion } from "framer-motion";
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
import { useEffect, useMemo, useRef, useState } from "react";

import { LudoSoundEngine } from "./audio/SoundEngine";
import { GameHud } from "./components/GameHud";
import { LudoBoard } from "./components/LudoBoard";
import { PassDeviceOverlay } from "./components/PassDeviceOverlay";
import { ParticleCanvas } from "./effects/ParticleCanvas";
import { useParticles } from "./effects/useParticles";

import { COLOR_META } from "./game/board";
import { getActivePlayer } from "./game/engine";
import { PLAYER_COLORS, type GameMode, type LudoGameState, type LudoPlayer } from "./game/types";
import { useLudoGame } from "./hooks/useLudoGame";
import { usePeerLudo } from "./hooks/usePeerLudo";
import { createRoomLink, generateInviteSecret, generateRoomCode, normaliseRoomCode } from "./online/roomCode";
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
    badge: "MOST PLAYED",
  },
  {
    mode: "pass",
    title: "Pass & Play",
    description: "A private turn handoff lets friends share one screen or device.",
    icon: Users,
    accent: "mint",
    tag: "1 DEVICE",
  },
  {
    mode: "online",
    title: "Online Room",
    description: "Create a five-digit room, send a secure link, and play anywhere.",
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
  pingMs: isBot ? undefined : 18 + colorIndex * 9,
  avatarSeed: `${colorIndex}-${name}`,
});

export interface LudoArenaProps {
  /** Lets the eventual page hand in a deep-linked room code. */
  initialRoomCode?: string;
}

export const LudoArena = ({ initialRoomCode }: LudoArenaProps) => {
  const controller = useLudoGame();
  const peer = usePeerLudo();
  const [view, setView] = useState<LobbyView>(initialRoomCode ? "online" : "home");
  const [selectedMode, setSelectedMode] = useState<GameMode>("single");
  const [playerCount, setPlayerCount] = useState(2);
  const [botCount, setBotCount] = useState(1);
  const [playerNames, setPlayerNames] = useState(defaultNames);
  const [muted, setMuted] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [inviteSecret, setInviteSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);
  const [showSixBurst, setShowSixBurst] = useState(false);
  const [boardShaking, setBoardShaking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // --- Sound engine (top-level, unconditional) ---
  const soundRef = useRef<LudoSoundEngine | null>(null);
  useEffect(() => {
    if (!soundRef.current) soundRef.current = new LudoSoundEngine();
    soundRef.current.muted = muted;
  }, [muted]);

  // --- Particle system (top-level, unconditional) ---
  const particles = useParticles();
  const prevDiceValueRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevMoveFingerprintRef = useRef<string | null>(null);
  const boardShellRef = useRef<HTMLDivElement>(null);

  const onlineGame = peer.game;
  const activeGame: LudoGameState | null = onlineGame ?? controller.game;
  const isOnline = onlineGame !== null;
  const myTurn = isOnline
    ? peer.role === "host"
      ? getActivePlayer(onlineGame).id === "host-seat"
      : getActivePlayer(onlineGame).id === peer.mySeatKey
    : true;

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
      setInviteSecret(deepLinkedSecret);
      setView("online");
      setOnlineNotice("Invite detected. Add your name, then join the room.");
    }
  }, [initialRoomCode]);

  // --- Sound & particle effects (dice) ---
  useEffect(() => {
    const state = activeGame;
    if (!state) {
      prevDiceValueRef.current = null;
      prevPhaseRef.current = null;
      prevMoveFingerprintRef.current = null;
      return;
    }
    if (state.diceValue !== null && state.diceValue !== prevDiceValueRef.current && prevPhaseRef.current === "rolling") {
      soundRef.current?.diceRoll();
      if (state.diceValue === 6) {
        soundRef.current?.sixRoll();
        setShowSixBurst(true);
        setTimeout(() => setShowSixBurst(false), 700);
        const shell = boardShellRef.current;
        if (shell) {
          const rect = shell.getBoundingClientRect();
          particles.emit("six", { x: rect.width * 0.85, y: rect.height * 0.08 });
        }
      }
    }
    prevDiceValueRef.current = state.diceValue;
    prevPhaseRef.current = state.phase;
  }, [activeGame, particles]);

  // --- Sound & particle effects (moves, captures, finishes) ---
  useEffect(() => {
    const state = activeGame;
    if (!state?.lastMove) return;
    const move = state.lastMove;
    const fingerprint = `${move.playerColor}-${move.tokenIndex}-${move.from}-${move.to}`;
    if (fingerprint === prevMoveFingerprintRef.current) return;
    prevMoveFingerprintRef.current = fingerprint;

    soundRef.current?.tokenMove();

    if (move.captured.length > 0) {
      soundRef.current?.tokenCapture();
      setBoardShaking(true);
      setTimeout(() => setBoardShaking(false), 400);
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
  }, [activeGame, particles]);

  useEffect(() => {
    const state = activeGame;
    if (!state || state.phase !== "finished") return;
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
    soundRef.current?.turnChime();
  }, [activeGame, activeGame?.activePlayerIndex, activeGame?.phase, activeGame?.revision]);

  useEffect(() => {
    const engine = soundRef.current;
    return () => engine?.dispose();
  }, []);

  const updateName = (index: number, value: string): void => {
    setPlayerNames((names) => names.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  const openMode = (mode: GameMode): void => {
    setSelectedMode(mode);
    setView(mode === "online" ? "online" : "setup");
  };

  const startLocalMatch = (mode: "single" | "pass"): void => {
    setIsLaunching(true);
    setTimeout(() => {
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
        rules: { turnDurationSeconds: 30, rankedFinish: true, blockadesEnabled: true },
      });
      setIsLaunching(false);
    }, 400);
  };

  const createRoom = (): void => {
    const code = generateRoomCode();
    const secret = generateInviteSecret();
    setRoomCode(code);
    setInviteSecret(secret);
    setOnlineNotice("Room number reserved. Open the room to go live for friends.");
  };

  const openRoom = (): void => {
    const name = compactName(playerNames[0], "Host");
    peer.hostRoom(roomCode, name);
    setOnlineNotice(null);
  };

  const joinRoom = (): void => {
    const code = normaliseRoomCode(roomCode);
    if (code.length !== 5) {
      setOnlineNotice("Enter the five-digit room number first.");
      return;
    }
    setRoomCode(code);
    peer.joinRoom(code, compactName(playerNames[0], "Guest"));
  };

  const copyInvite = async (): Promise<void> => {
    if (!activeRoomLink) return;
    try {
      await navigator.clipboard.writeText(activeRoomLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_900);
    } catch {
      setOnlineNotice("Copy the invite from the address shown below.");
    }
  };

  const leaveMatch = (): void => {
    peer.leave();
    controller.leave();
    setView("home");
  };

  if (activeGame) {
    const state = activeGame;
    const winnerColor = state.winnerOrder[0];
    const winner = winnerColor ? state.players.find((player) => player.color === winnerColor) : null;
    const active = getActivePlayer(state);

    return (
      <main className="ludo-arena">
        <div className="ludo-stars" aria-hidden="true" />
        <div className="ludo-game-stage">
          <GameHud
            state={state}
            now={controller.now}
            isDiceRolling={controller.isDiceRolling && !isOnline}
            muted={muted}
            onRoll={isOnline ? peer.roll : controller.roll}
            onLeave={leaveMatch}
            onSkipTurn={isOnline ? peer.forfeit : controller.skipTurn}
            onToggleMute={() => setMuted((value) => !value)}
            interactionLocked={(isOnline && !myTurn) || Boolean(controller.handoffPlayerName) || (!isOnline && active.isBot)}
          />

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

            <div ref={boardShellRef} style={{ position: "relative" }}>
              <LudoBoard
                state={state}
                onTokenSelect={isOnline ? peer.move : controller.move}
                interactionDisabled={(isOnline && !myTurn) || Boolean(controller.handoffPlayerName) || (!isOnline && active.isBot)}
                boardShaking={boardShaking}
              />
              <ParticleCanvas bindCanvas={particles.bindCanvas} />
              {showSixBurst && <div className="ludo-six-burst" aria-hidden="true">SIX!</div>}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {controller.handoffPlayerName && (
            <PassDeviceOverlay playerName={controller.handoffPlayerName} onReady={controller.dismissHandoff} />
          )}
          {state.phase === "finished" && (
            <motion.div className="ludo-result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.section className="ludo-result-card" initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}>
                <span className="ludo-result-crown"><Crown size={34} /></span>
                <span className="ludo-eyebrow">CHAMPION</span>
                <h2>{winner?.name ?? "Match complete"}</h2>
                <p>{winner ? `${COLOR_META[winner.color].label} reached home first.` : "A brilliant game."}</p>
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
                  {isOnline && peer.role !== "host" ? (
                    <button type="button" className="ludo-primary-button" onClick={leaveMatch}>Back to lobby</button>
                  ) : (
                    <button
                      type="button"
                      className="ludo-primary-button"
                      onClick={() => { if (isOnline) peer.restartMatch(); else controller.restart(); }}
                    >
                      <Play size={17} /> {isOnline ? "Rematch" : "Play again"}
                    </button>
                  )}
                  <button type="button" className="ludo-secondary-button" onClick={leaveMatch}>Lobby</button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    );
  }

  if (peer.status === "connecting" || peer.status === "lobby") {
    const isHost = peer.role === "host";
    const canStart = isHost && peer.lobbyPlayers.length >= 2;
    return (
      <main className="ludo-arena ludo-lobby">
        <div className="ludo-stars" aria-hidden="true" />
        <section className="ludo-lobby-shell">
          <header className="ludo-lobby-header">
            <button type="button" className="ludo-back-link" onClick={() => { peer.leave(); setView("online"); }}>
              <ChevronLeft size={18} /> Room setup
            </button>
            <span className="ludo-lobby-availability"><span /> ROOM {peer.status === "connecting" ? "OPENING" : "LIVE"}</span>
          </header>

          <motion.section className="ludo-online-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="ludo-setup-topline">
              <span className="ludo-mode-icon is-amber"><Wifi size={23} /></span>
              <div>
                <span className="ludo-eyebrow">ONLINE ROOM</span>
                <h2>{peer.status === "connecting" ? "Opening the room…" : `Room ${peer.status === "lobby" && isHost ? roomCode : "joined"}`}</h2>
              </div>
            </div>

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
                      <span className="ludo-lobby-player-name"><strong>Waiting…</strong><small>SHARE THE CODE</small></span>
                    </article>
                  ))}
                </div>

                {peer.notice && <p className="ludo-online-notice"><Sparkles size={15} /> {peer.notice}</p>}

                {isHost ? (
                  <div className="ludo-online-actions">
                    <button type="button" className="ludo-secondary-button" onClick={peer.addBot} disabled={peer.lobbyPlayers.length >= 4}>
                      <UserPlus size={17} /> Fill with a bot
                    </button>
                    <button type="button" className="ludo-primary-button ludo-full-button" onClick={peer.startMatch} disabled={!canStart}>
                      <Play size={18} /> {canStart ? "Start match" : "Need at least 2 players"}
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
    <main className="ludo-arena ludo-lobby">
      <div className="ludo-stars" aria-hidden="true" />
      <section className="ludo-lobby-shell">
        <header className="ludo-lobby-header">
          {view !== "home" ? (
            <button type="button" className="ludo-back-link" onClick={() => { peer.leave(); setView("home"); }}><ChevronLeft size={18} /> Game modes</button>
          ) : <span className="ludo-lobby-availability"><span /> LIVE GAME ROOM</span>}
          <button type="button" className="ludo-help-link"><ShieldCheck size={16} /> Fair play rules</button>
        </header>

        {view === "home" && (
          <>
            <div className="ludo-hero">
              <motion.div className="ludo-hero-dice ludo-hero-dice-one" animate={{ y: [0, -12, 0], rotate: [-8, 6, -8] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </motion.div>
              <motion.div className="ludo-hero-dice ludo-hero-dice-two" animate={{ y: [0, 10, 0], rotate: [12, -4, 12] }} transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </motion.div>
              <motion.div className="ludo-hero-orb" animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                <span className="ludo-hero-orb-face is-a" /><span className="ludo-hero-orb-face is-b" /><span className="ludo-hero-orb-face is-c" /><span className="ludo-hero-orb-face is-d" />
              </motion.div>
              <span className="ludo-eyebrow">A PREMIUM TABLETOP EXPERIENCE</span>
              <h1>Roll bold.<br /><em>Play brilliant.</em></h1>
              <p>A slick, fair and responsive Ludo arena for your favourite people.</p>
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
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.09 }}
                    whileHover={{ y: -6, transition: { duration: 0.18 } }}
                    whileTap={{ scale: 0.985 }}
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
              <span><Link2 size={16} /> Secure friend invites</span>
            </footer>
          </>
        )}

        {view === "setup" && (
          <motion.section className="ludo-setup-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
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
                <div className="ludo-segmented-control">
                  {[1, 2, 3].map((value) => <button type="button" key={value} className={botCount === value ? "is-selected" : ""} onClick={() => setBotCount(value)}>{value} bot{value > 1 ? "s" : ""}</button>)}
                </div>
              </div>
            ) : (
              <>
                <div className="ludo-choice-group">
                  <span className="ludo-field-label">Players at this device</span>
                  <div className="ludo-segmented-control">
                    {[2, 3, 4].map((value) => <button type="button" key={value} className={playerCount === value ? "is-selected" : ""} onClick={() => setPlayerCount(value)}>{value} players</button>)}
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

            <div className="ludo-rule-preview"><ShieldCheck size={17} /> 30-second turns · safe star squares · exact home roll · fair bot logic</div>
            <button type="button" className="ludo-primary-button ludo-full-button" onClick={() => startLocalMatch(selectedMode === "single" ? "single" : "pass")}>
              <Play size={18} /> Start game
            </button>
          </motion.section>
        )}

        {view === "online" && (
          <motion.section className="ludo-online-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
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
                <input inputMode="numeric" value={roomCode} onChange={(event) => setRoomCode(normaliseRoomCode(event.target.value))} placeholder="5-digit room no." aria-label="Room number" />
                <button type="button" className="ludo-secondary-button" onClick={joinRoom} disabled={!compactName(playerNames[0], "")}>Join</button>
              </div>
            </div>

            {roomCode && (
              <div className="ludo-room-created">
                <span className="ludo-room-label">ROOM NUMBER</span>
                <strong>{roomCode}</strong>
                {activeRoomLink ? (
                  <>
                    <code>{activeRoomLink}</code>
                    <button type="button" className="ludo-copy-link" onClick={copyInvite}><Copy size={15} /> {copied ? "Copied" : "Copy invite link"}</button>
                  </>
                ) : <p>Create a new room to generate a private invite link.</p>}
              </div>
            )}

            {onlineNotice && <p className="ludo-online-notice"><Sparkles size={15} /> {onlineNotice}</p>}

            <div className="ludo-online-safety"><ShieldCheck size={16} /> Friends join with the room number as temporary guests — no sign-up wall. The host device referees the match.</div>
            <button type="button" className="ludo-primary-button ludo-full-button" onClick={openRoom} disabled={!roomCode || !compactName(playerNames[0], "")}>
              <Play size={18} /> Open room & go live
            </button>
            {peer.error && <p className="ludo-online-error"><X size={15} /> {peer.error}</p>}
          </motion.section>
        )}
      </section>

      <AnimatePresence>
        {isLaunching && (
          <motion.div
            className="ludo-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="ludo-loading-card">
              <Sparkles className="ludo-loading-icon" size={32} />
              <h3>Initializing Match...</h3>
              <p>Spawning tokens & preparing board</p>
              <div className="ludo-loading-bar-track">
                <div className="ludo-loading-bar-fill" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};
