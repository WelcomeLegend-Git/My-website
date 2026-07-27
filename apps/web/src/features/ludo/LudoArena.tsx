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
  Users,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LudoSoundEngine } from "./audio/SoundEngine";
import { ParticleCanvas } from "./effects/ParticleCanvas";
import { useParticles } from "./effects/useParticles";

import { LudoBoard } from "./components/LudoBoard";
import { GameHud } from "./components/GameHud";
import { PassDeviceOverlay } from "./components/PassDeviceOverlay";
import { COLOR_META } from "./game/board";
import { getActivePlayer } from "./game/engine";
import { PLAYER_COLORS, type GameMode, type LudoPlayer } from "./game/types";
import { useLudoGame } from "./hooks/useLudoGame";
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
}> = [
  {
    mode: "single",
    title: "Solo Arena",
    description: "Challenge smart bots with a real turn clock and tactical moves.",
    icon: Bot,
    accent: "violet",
    tag: "VS AI",
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
  if (!soundRef.current) soundRef.current = new LudoSoundEngine();
  soundRef.current.muted = muted;

  // --- Particle system (top-level, unconditional) ---
  const particles = useParticles();
  const prevDiceValueRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevRevisionRef = useRef<number>(0);
  const boardShellRef = useRef<HTMLDivElement>(null);

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

  // --- Sound & particle effects (top-level, guarded) ---
  useEffect(() => {
    const state = controller.game;
    if (!state) return;
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
  }, [controller.game?.diceValue, controller.game?.phase, particles]);

  useEffect(() => {
    const state = controller.game;
    const result = controller.lastMoveResult;
    if (!state || !result || state.revision === prevRevisionRef.current) return;
    prevRevisionRef.current = state.revision;
    const active = getActivePlayer(state);

    soundRef.current?.tokenMove();

    if (result.captured.length > 0) {
      soundRef.current?.tokenCapture();
      setBoardShaking(true);
      setTimeout(() => setBoardShaking(false), 400);
      const shell = boardShellRef.current;
      if (shell) {
        const rect = shell.getBoundingClientRect();
        particles.emit("capture", { x: rect.width / 2, y: rect.height / 2 }, result.captured[0].color);
      }
    }

    if (result.finishedToken) {
      soundRef.current?.tokenFinish();
      const shell = boardShellRef.current;
      if (shell) {
        const rect = shell.getBoundingClientRect();
        particles.emit("finishToken", { x: rect.width / 2, y: rect.height / 2 }, active.color);
      }
    }
  }, [controller.lastMoveResult, controller.game?.revision, particles]);

  useEffect(() => {
    const state = controller.game;
    if (!state || state.phase !== "finished") return;
    soundRef.current?.victory();
    const shell = boardShellRef.current;
    if (shell) {
      const rect = shell.getBoundingClientRect();
      particles.emit("victory", { x: rect.width / 2, y: 0 });
    }
  }, [controller.game?.phase, particles]);

  useEffect(() => {
    const state = controller.game;
    if (!state || state.phase !== "rolling" || state.revision <= 1) return;
    soundRef.current?.turnChime();
  }, [controller.game?.activePlayerIndex, controller.game?.phase, controller.game?.revision]);

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
    setOnlineNotice("Room ready. The server will create a guest identity after your name is confirmed.");
  };

  const joinRoom = (): void => {
    const code = normaliseRoomCode(roomCode);
    if (code.length !== 5) {
      setOnlineNotice("Enter the five-digit room number first.");
      return;
    }
    setRoomCode(code);
    setOnlineNotice("Room ready. The server will create a guest identity after your name is confirmed.");
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

  const startRoomPreview = (): void => {
    setIsLaunching(true);
    setTimeout(() => {
      const hostName = compactName(playerNames[0], "Host");
      controller.start({
        id: `room-${roomCode || generateRoomCode()}`,
        mode: "online",
        players: [
          createPlayer(0, hostName),
          createPlayer(1, "Friend seat"),
        ],
        rules: { turnDurationSeconds: 30, rankedFinish: true, blockadesEnabled: true },
      });
      setIsLaunching(false);
    }, 400);
  };

  if (controller.game) {
    const state = controller.game;
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
            isDiceRolling={controller.isDiceRolling}
            muted={muted}
            onRoll={controller.roll}
            onLeave={() => { controller.leave(); setView("home"); }}
            onSkipTurn={controller.skipTurn}
            onToggleMute={() => setMuted((value) => !value)}
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
                onTokenSelect={controller.move}
                interactionDisabled={Boolean(controller.handoffPlayerName) || active.isBot}
                boardShaking={boardShaking}
              />
              <ParticleCanvas particles={particles} />
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
                <div className="ludo-result-actions">
                  <button type="button" className="ludo-primary-button" onClick={controller.restart}><Play size={17} /> Play again</button>
                  <button type="button" className="ludo-secondary-button" onClick={() => { controller.leave(); setView("home"); }}>Lobby</button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    );
  }

  return (
    <main className="ludo-arena ludo-lobby">
      <div className="ludo-stars" aria-hidden="true" />
      <section className="ludo-lobby-shell">
        <header className="ludo-lobby-header">
          {view !== "home" ? (
            <button type="button" className="ludo-back-link" onClick={() => setView("home")}><ChevronLeft size={18} /> Game modes</button>
          ) : <span className="ludo-lobby-availability"><span /> LIVE GAME ROOM</span>}
          <button type="button" className="ludo-help-link"><ShieldCheck size={16} /> Fair play rules</button>
        </header>

        {view === "home" && (
          <>
            <div className="ludo-hero">
              <motion.div className="ludo-hero-orb" animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                <span>✦</span>
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
              <button type="button" className="ludo-create-room" onClick={createRoom}><Plus size={18} /> Create a new room</button>
              <div className="ludo-join-row">
                <input inputMode="numeric" value={roomCode} onChange={(event) => setRoomCode(normaliseRoomCode(event.target.value))} placeholder="5-digit room no." aria-label="Room number" />
                <button type="button" className="ludo-secondary-button" onClick={joinRoom}>Join</button>
              </div>
            </div>

            {roomCode && (
              <div className="ludo-room-created">
                <span className="ludo-room-label">ROOM NUMBER</span>
                <strong>{roomCode}</strong>
                {activeRoomLink ? (
                  <>
                    <code>{activeRoomLink}</code>
                    <button type="button" className="ludo-copy-link" onClick={copyInvite}><Copy size={15} /> {copied ? "Copied" : "Copy secure invite"}</button>
                  </>
                ) : <p>Paste the matching secure invite link to preserve private access.</p>}
              </div>
            )}

            {onlineNotice && <p className="ludo-online-notice"><Sparkles size={15} /> {onlineNotice}</p>}
            <div className="ludo-online-safety"><ShieldCheck size={16} /> New friends enter as a temporary guest after naming themselves—no sign-up wall.</div>
            <button type="button" className="ludo-primary-button ludo-full-button" onClick={startRoomPreview} disabled={!roomCode}>
              <Play size={18} /> Preview board locally
            </button>
            <p className="ludo-preview-caption">This opens a local preview. Live online play requires the server merge. The room transport, guest protocol, and database contract are included for integration.</p>
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
