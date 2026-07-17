export const PLAYER_COLORS = ["red", "blue", "yellow", "green"] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];
export type GameMode = "single" | "pass" | "online";
export type GamePhase = "lobby" | "rolling" | "moving" | "finished";
export type PlayerConnection = "ready" | "waiting" | "reconnecting" | "offline" | "bot";
export type TokenPosition = -1 | number;

export const HOME_POSITION = -1;
export const FINISH_POSITION = 57;
export const TOKENS_PER_PLAYER = 4;

export interface LudoRules {
  turnDurationSeconds: number;
  requireSixToLeaveHome: boolean;
  threeSixesLoseTurn: boolean;
  captureGrantsExtraTurn: boolean;
  finishGrantsExtraTurn: boolean;
  blockadesEnabled: boolean;
  moveLogLimit: number;
  rankedFinish: boolean;
}

export interface LudoPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  connection: PlayerConnection;
  pingMs?: number;
  avatarSeed?: string;
}

export interface LastMove {
  playerColor: PlayerColor;
  tokenIndex: number;
  from: TokenPosition;
  to: TokenPosition;
  captured: Array<{ color: PlayerColor; tokenIndex: number }>;
  finished: boolean;
  rolled: number;
}

export interface MoveLogEntry {
  id: string;
  at: number;
  kind: "roll" | "move" | "capture" | "finish" | "turn-lost" | "timeout";
  playerColor: PlayerColor;
  text: string;
}

export interface LudoGameState {
  id: string;
  mode: GameMode;
  phase: GamePhase;
  players: LudoPlayer[];
  tokens: Record<PlayerColor, TokenPosition[]>;
  activePlayerIndex: number;
  diceValue: number | null;
  legalTokenIndexes: number[];
  consecutiveSixes: number;
  winnerOrder: PlayerColor[];
  lastMove: LastMove | null;
  moveLog: MoveLogEntry[];
  turnStartedAt: number;
  turnEndsAt: number;
  revision: number;
  rules: LudoRules;
}

export interface GameSetup {
  id?: string;
  mode: GameMode;
  players: LudoPlayer[];
  rules?: Partial<LudoRules>;
  now?: number;
}

export interface MoveResult {
  state: LudoGameState;
  captured: Array<{ color: PlayerColor; tokenIndex: number }>;
  finishedToken: boolean;
  extraTurn: boolean;
}

export type GameIntent =
  | { type: "ROLL"; value: number; now?: number }
  | { type: "MOVE"; tokenIndex: number; now?: number }
  | { type: "FORFEIT"; now?: number; reason?: "timeout" | "manual" };

export const DEFAULT_LUDO_RULES: LudoRules = {
  turnDurationSeconds: 30,
  requireSixToLeaveHome: true,
  threeSixesLoseTurn: true,
  captureGrantsExtraTurn: true,
  finishGrantsExtraTurn: true,
  blockadesEnabled: true,
  moveLogLimit: 64,
  rankedFinish: true,
};
