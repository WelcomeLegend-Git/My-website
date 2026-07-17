import {
  DEFAULT_LUDO_RULES,
  FINISH_POSITION,
  HOME_POSITION,
  type GameIntent,
  type GameSetup,
  type LastMove,
  type LudoGameState,
  type LudoPlayer,
  type MoveLogEntry,
  type MoveResult,
  type PlayerColor,
  PLAYER_COLORS,
  type TokenPosition,
  TOKENS_PER_PLAYER,
} from "./types";

export const RING_LENGTH = 52;
export const HOME_LANE_START = 52;
export const SAFE_RING_INDICES = [0, 8, 13, 21, 26, 34, 39, 47] as const;

export const START_RING_INDEX: Record<PlayerColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39,
};

export class LudoRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LudoRuleError";
  }
}

const isDieValue = (value: number): value is 1 | 2 | 3 | 4 | 5 | 6 =>
  Number.isInteger(value) && value >= 1 && value <= 6;

const makeLog = (
  kind: MoveLogEntry["kind"],
  playerColor: PlayerColor,
  text: string,
  at: number,
): MoveLogEntry => ({
  id: `${at}-${kind}-${playerColor}-${Math.random().toString(36).slice(2, 7)}`,
  at,
  kind,
  playerColor,
  text,
});

const cloneTokens = (tokens: LudoGameState["tokens"]): LudoGameState["tokens"] => ({
  red: [...tokens.red],
  blue: [...tokens.blue],
  yellow: [...tokens.yellow],
  green: [...tokens.green],
});

const findPlayerIndexAfter = (state: LudoGameState, currentIndex: number): number | null => {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidateIndex = (currentIndex + offset) % state.players.length;
    const candidate = state.players[candidateIndex];
    if (!state.winnerOrder.includes(candidate.color)) {
      return candidateIndex;
    }
  }

  return null;
};

const remainingPlayers = (state: LudoGameState): number =>
  state.players.filter((player) => !state.winnerOrder.includes(player.color)).length;

export const getActivePlayer = (state: LudoGameState): LudoPlayer => state.players[state.activePlayerIndex];

export const getRingIndex = (color: PlayerColor, position: TokenPosition): number | null => {
  if (position < 0 || position >= HOME_LANE_START) return null;
  return (START_RING_INDEX[color] + position) % RING_LENGTH;
};

export const isSafeRingIndex = (ringIndex: number): boolean =>
  SAFE_RING_INDICES.includes(ringIndex as (typeof SAFE_RING_INDICES)[number]);

export const getDestination = (
  position: TokenPosition,
  roll: number,
  requireSixToLeaveHome = true,
): TokenPosition | null => {
  if (position === FINISH_POSITION) return null;
  if (position === HOME_POSITION) return !requireSixToLeaveHome || roll === 6 ? 0 : null;

  const destination = position + roll;
  return destination <= FINISH_POSITION ? destination : null;
};

const tokensOnRingIndex = (
  state: LudoGameState,
  ringIndex: number,
): Array<{ color: PlayerColor; tokenIndex: number }> => {
  const matches: Array<{ color: PlayerColor; tokenIndex: number }> = [];
  for (const color of PLAYER_COLORS) {
    state.tokens[color].forEach((position, tokenIndex) => {
      if (getRingIndex(color, position) === ringIndex) matches.push({ color, tokenIndex });
    });
  }
  return matches;
};

export const getBlockadeRingIndexes = (state: LudoGameState): number[] => {
  const counts = new Map<number, number>();
  for (const color of PLAYER_COLORS) {
    for (const position of state.tokens[color]) {
      const ringIndex = getRingIndex(color, position);
      if (ringIndex !== null) counts.set(ringIndex, (counts.get(ringIndex) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([index]) => index);
};

const wouldCrossBlockade = (
  state: LudoGameState,
  color: PlayerColor,
  position: TokenPosition,
  destination: TokenPosition,
): boolean => {
  if (!state.rules.blockadesEnabled || position === HOME_POSITION) return false;

  const blockades = new Set(getBlockadeRingIndexes(state));
  const startProgress = Math.max(position + 1, 0);
  const endProgress = Math.min(destination, HOME_LANE_START - 1);
  for (let progress = startProgress; progress <= endProgress; progress += 1) {
    const ringIndex = getRingIndex(color, progress);
    if (ringIndex !== null && blockades.has(ringIndex)) return true;
  }
  return false;
};

const isBlockedLanding = (
  state: LudoGameState,
  color: PlayerColor,
  destination: TokenPosition,
): boolean => {
  const ringIndex = getRingIndex(color, destination);
  if (ringIndex === null || !state.rules.blockadesEnabled) return false;
  const opponents = tokensOnRingIndex(state, ringIndex).filter((token) => token.color !== color);
  return opponents.length >= 2;
};

export const getLegalTokenIndexes = (
  state: LudoGameState,
  playerColor: PlayerColor = getActivePlayer(state).color,
  roll: number | null = state.diceValue,
): number[] => {
  if (roll === null || !isDieValue(roll)) return [];

  return state.tokens[playerColor].flatMap((position, tokenIndex) => {
    const destination = getDestination(position, roll, state.rules.requireSixToLeaveHome);
    if (destination === null) return [];
    if (wouldCrossBlockade(state, playerColor, position, destination)) return [];
    if (isBlockedLanding(state, playerColor, destination)) return [];
    return [tokenIndex];
  });
};

export const isPlayerFinished = (state: LudoGameState, color: PlayerColor): boolean =>
  state.tokens[color].every((position) => position === FINISH_POSITION);

export const isGameFinished = (state: LudoGameState): boolean =>
  remainingPlayers(state) <= 1 || state.winnerOrder.length >= state.players.length - 1;

export const createGame = ({ id, mode, players, rules, now = Date.now() }: GameSetup): LudoGameState => {
  if (players.length < 2 || players.length > PLAYER_COLORS.length) {
    throw new LudoRuleError("Ludo needs between two and four players.");
  }

  const colors = new Set(players.map((player) => player.color));
  if (colors.size !== players.length) throw new LudoRuleError("Every player needs a different colour.");

  const normalizedPlayers = players.map((player) => ({
    ...player,
    connection: player.isBot ? "bot" : player.connection,
  }));

  return {
    id: id ?? `local-${now.toString(36)}`,
    mode,
    phase: "rolling",
    players: normalizedPlayers,
    tokens: {
      red: Array<TokenPosition>(TOKENS_PER_PLAYER).fill(HOME_POSITION),
      blue: Array<TokenPosition>(TOKENS_PER_PLAYER).fill(HOME_POSITION),
      yellow: Array<TokenPosition>(TOKENS_PER_PLAYER).fill(HOME_POSITION),
      green: Array<TokenPosition>(TOKENS_PER_PLAYER).fill(HOME_POSITION),
    },
    activePlayerIndex: 0,
    diceValue: null,
    legalTokenIndexes: [],
    consecutiveSixes: 0,
    winnerOrder: [],
    lastMove: null,
    moveLog: [makeLog("roll", normalizedPlayers[0].color, `${normalizedPlayers[0].name} starts the match.`, now)],
    turnStartedAt: now,
    turnEndsAt: now + (rules?.turnDurationSeconds ?? DEFAULT_LUDO_RULES.turnDurationSeconds) * 1_000,
    revision: 0,
    rules: { ...DEFAULT_LUDO_RULES, ...rules },
  };
};

const withRevision = (state: LudoGameState): LudoGameState => ({ ...state, revision: state.revision + 1 });

export const advanceTurn = (
  state: LudoGameState,
  now = Date.now(),
  reason?: "timeout" | "three-sixes" | "no-move" | "manual",
): LudoGameState => {
  if (isGameFinished(state)) {
    return withRevision({
      ...state,
      phase: "finished",
      diceValue: null,
      legalTokenIndexes: [],
      consecutiveSixes: 0,
    });
  }

  const nextIndex = findPlayerIndexAfter(state, state.activePlayerIndex);
  if (nextIndex === null) {
    return withRevision({ ...state, phase: "finished", diceValue: null, legalTokenIndexes: [] });
  }

  const log = reason
    ? [
        ...state.moveLog,
        makeLog(
          reason === "timeout" ? "timeout" : "turn-lost",
          getActivePlayer(state).color,
          reason === "three-sixes"
            ? `${getActivePlayer(state).name} rolled three sixes. Turn lost.`
            : reason === "timeout"
              ? `${getActivePlayer(state).name}'s turn timed out.`
              : reason === "no-move"
                ? `${getActivePlayer(state).name} had no legal move.`
                : `${getActivePlayer(state).name} ended their turn.`,
          now,
        ),
      ]
    : state.moveLog;

  return withRevision({
    ...state,
    activePlayerIndex: nextIndex,
    phase: "rolling",
    diceValue: null,
    legalTokenIndexes: [],
    consecutiveSixes: 0,
    turnStartedAt: now,
    turnEndsAt: now + state.rules.turnDurationSeconds * 1_000,
    moveLog: log.slice(-16),
  });
};

export const rollDice = (state: LudoGameState, value: number, now = Date.now()): LudoGameState => {
  if (state.phase !== "rolling") throw new LudoRuleError("The current player must finish their move first.");
  if (!isDieValue(value)) throw new LudoRuleError("Dice values must be between one and six.");

  const active = getActivePlayer(state);
  const consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : 0;
  const rollLog = makeLog("roll", active.color, `${active.name} rolled a ${value}.`, now);

  if (state.rules.threeSixesLoseTurn && consecutiveSixes >= 3) {
    return advanceTurn(
      withRevision({
        ...state,
        diceValue: value,
        consecutiveSixes,
        moveLog: [...state.moveLog, rollLog].slice(-16),
      }),
      now,
      "three-sixes",
    );
  }

  const rolledState = withRevision({
    ...state,
    diceValue: value,
    consecutiveSixes,
    legalTokenIndexes: [],
    moveLog: [...state.moveLog, rollLog].slice(-16),
  });
  const legalTokenIndexes = getLegalTokenIndexes(rolledState);

  if (legalTokenIndexes.length === 0) return advanceTurn(rolledState, now, "no-move");

  return { ...rolledState, phase: "moving", legalTokenIndexes };
};

const getCaptures = (
  state: LudoGameState,
  playerColor: PlayerColor,
  destination: TokenPosition,
): Array<{ color: PlayerColor; tokenIndex: number }> => {
  const ringIndex = getRingIndex(playerColor, destination);
  if (ringIndex === null || isSafeRingIndex(ringIndex)) return [];
  const opponents = tokensOnRingIndex(state, ringIndex).filter((token) => token.color !== playerColor);
  return opponents.length === 1 ? opponents : [];
};

export const moveToken = (state: LudoGameState, tokenIndex: number, now = Date.now()): MoveResult => {
  if (state.phase !== "moving" || state.diceValue === null) {
    throw new LudoRuleError("Roll the dice before moving a token.");
  }
  if (!state.legalTokenIndexes.includes(tokenIndex)) {
    throw new LudoRuleError("That token cannot use this dice roll.");
  }

  const active = getActivePlayer(state);
  const from = state.tokens[active.color][tokenIndex];
  const destination = getDestination(from, state.diceValue, state.rules.requireSixToLeaveHome);
  if (destination === null) throw new LudoRuleError("That token cannot move there.");

  const captured = getCaptures(state, active.color, destination);
  const tokens = cloneTokens(state.tokens);
  tokens[active.color][tokenIndex] = destination;
  for (const capturedToken of captured) tokens[capturedToken.color][capturedToken.tokenIndex] = HOME_POSITION;

  const finishedToken = destination === FINISH_POSITION;
  const playerFinished = tokens[active.color].every((position) => position === FINISH_POSITION);
  const winnerOrder = playerFinished && !state.winnerOrder.includes(active.color)
    ? [...state.winnerOrder, active.color]
    : state.winnerOrder;
  const lastMove: LastMove = {
    playerColor: active.color,
    tokenIndex,
    from,
    to: destination,
    captured,
    finished: finishedToken,
    rolled: state.diceValue,
  };

  const moveLog: MoveLogEntry[] = [
    ...state.moveLog,
    makeLog("move", active.color, `${active.name} moved a token ${state.diceValue} spaces.`, now),
    ...captured.map((capturedToken) =>
      makeLog("capture", active.color, `${active.name} sent ${capturedToken.color} home.`, now),
    ),
    ...(finishedToken ? [makeLog("finish", active.color, `${active.name} brought a token home.`, now)] : []),
  ].slice(-16);

  const movedState = withRevision({
    ...state,
    tokens,
    winnerOrder,
    lastMove,
    moveLog,
    diceValue: null,
    legalTokenIndexes: [],
  });

  if (isGameFinished(movedState)) {
    return {
      state: withRevision({ ...movedState, phase: "finished", consecutiveSixes: 0 }),
      captured,
      finishedToken,
      extraTurn: false,
    };
  }

  const extraTurn =
    !playerFinished &&
    (lastMove.rolled === 6 ||
      (captured.length > 0 && state.rules.captureGrantsExtraTurn) ||
      (finishedToken && state.rules.finishGrantsExtraTurn));

  if (extraTurn) {
    return {
      state: withRevision({
        ...movedState,
        phase: "rolling",
        turnStartedAt: now,
        turnEndsAt: now + state.rules.turnDurationSeconds * 1_000,
      }),
      captured,
      finishedToken,
      extraTurn: true,
    };
  }

  return {
    state: advanceTurn(movedState, now),
    captured,
    finishedToken,
    extraTurn: false,
  };
};

export const forfeitTurn = (
  state: LudoGameState,
  now = Date.now(),
  reason: "timeout" | "manual" = "manual",
): LudoGameState => {
  if (state.phase === "finished") return state;
  return advanceTurn(state, now, reason);
};

export const applyGameIntent = (state: LudoGameState, intent: GameIntent): LudoGameState => {
  switch (intent.type) {
    case "ROLL":
      return rollDice(state, intent.value, intent.now);
    case "MOVE":
      return moveToken(state, intent.tokenIndex, intent.now).state;
    case "FORFEIT":
      return forfeitTurn(state, intent.now, intent.reason);
    default:
      return state;
  }
};

const threatScore = (state: LudoGameState, playerColor: PlayerColor, position: TokenPosition): number => {
  const ringIndex = getRingIndex(playerColor, position);
  if (ringIndex === null || isSafeRingIndex(ringIndex)) return 0;

  let danger = 0;
  for (const opponent of state.players) {
    if (opponent.color === playerColor) continue;
    for (const enemyPosition of state.tokens[opponent.color]) {
      const enemyRing = getRingIndex(opponent.color, enemyPosition);
      if (enemyRing === null) continue;
      const distance = (ringIndex - enemyRing + RING_LENGTH) % RING_LENGTH;
      if (distance > 0 && distance <= 6) danger += 18 - distance * 2;
    }
  }
  return danger;
};

export const chooseBotMove = (state: LudoGameState): number | null => {
  if (state.diceValue === null || state.legalTokenIndexes.length === 0) return null;
  const color = getActivePlayer(state).color;
  let bestToken: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const tokenIndex of state.legalTokenIndexes) {
    const from = state.tokens[color][tokenIndex];
    const destination = getDestination(from, state.diceValue, state.rules.requireSixToLeaveHome);
    if (destination === null) continue;
    const captures = getCaptures(state, color, destination).length;
    const safe = getRingIndex(color, destination);
    const score =
      (destination === FINISH_POSITION ? 10_000 : 0) +
      captures * 3_000 +
      (from === HOME_POSITION ? 850 : 0) +
      (safe !== null && isSafeRingIndex(safe) ? 260 : 0) +
      Math.max(destination, 0) * 9 -
      threatScore(state, color, destination) +
      tokenIndex / 100;

    if (score > bestScore) {
      bestScore = score;
      bestToken = tokenIndex;
    }
  }

  return bestToken;
};

export const rollLocalDice = (): number => Math.floor(Math.random() * 6) + 1;
