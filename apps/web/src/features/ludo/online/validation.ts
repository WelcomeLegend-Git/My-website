import { z } from "zod";
import { FINISH_POSITION, HOME_POSITION } from "../game/types";

export const MAX_PACKET_SIZE = 65_536;
export const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const timeSchema = revisionSchema;
export const idSchema = z.string().min(1).max(128);
export const nameSchema = z.string().trim().min(1).max(16);
export const roomCodeSchema = z.string().regex(/^\d{5}$/);
export const secretSchema = z.string().regex(/^[a-f0-9]{48}$/);
export const colorSchema = z.enum(["red", "blue", "yellow", "green"]);
export const connectionSchema = z.enum(["ready", "waiting", "reconnecting", "offline", "bot"]);
export const tokenIndexSchema = z.number().int().min(0).max(3);
const positionSchema = z.number().int().min(HOME_POSITION).max(FINISH_POSITION);
const diceSchema = z.number().int().min(1).max(6);
const unique = <T>(values: T[]): boolean => new Set(values).size === values.length;

export const playerSchema = z.object({
  id: idSchema, name: nameSchema, color: colorSchema, isBot: z.boolean(), connection: connectionSchema,
  pingMs: z.number().finite().nonnegative().max(300_000).nullish(), avatarSeed: idSchema.nullish(),
}).strict();
export const playersSchema = z.array(playerSchema).max(4).refine((players) =>
  unique(players.map((p) => p.id)) && unique(players.map((p) => p.color)));

export const gameStateSchema = z.object({
  id: idSchema,
  mode: z.enum(["single", "pass", "online"]),
  phase: z.enum(["lobby", "rolling", "moving", "finished"]),
  players: playersSchema.refine((players) => players.length >= 2),
  tokens: z.object({
    red: z.array(positionSchema).length(4), blue: z.array(positionSchema).length(4),
    yellow: z.array(positionSchema).length(4), green: z.array(positionSchema).length(4),
  }).strict(),
  activePlayerIndex: z.number().int().min(0).max(3),
  diceValue: diceSchema.nullable(),
  legalTokenIndexes: z.array(tokenIndexSchema).max(4).refine(unique),
  consecutiveSixes: z.number().int().min(0).max(3),
  winnerOrder: z.array(colorSchema).max(4).refine(unique),
  lastMove: z.object({
    playerColor: colorSchema, tokenIndex: tokenIndexSchema, from: positionSchema, to: positionSchema,
    captured: z.array(z.object({ color: colorSchema, tokenIndex: tokenIndexSchema }).strict()).max(12),
    finished: z.boolean(), rolled: diceSchema,
  }).strict().nullable(),
  moveLog: z.array(z.object({
    id: idSchema, at: timeSchema,
    kind: z.enum(["roll", "move", "capture", "finish", "turn-lost", "timeout"]),
    playerColor: colorSchema, text: z.string().max(512),
  }).strict()).max(128),
  turnStartedAt: timeSchema, turnEndsAt: timeSchema, revision: revisionSchema,
  rules: z.object({
    turnDurationSeconds: z.number().int().min(1).max(3600),
    requireSixToLeaveHome: z.boolean(), threeSixesLoseTurn: z.boolean(),
    captureGrantsExtraTurn: z.boolean(), finishGrantsExtraTurn: z.boolean(),
    blockadesEnabled: z.boolean(), moveLogLimit: z.number().int().min(1).max(128), rankedFinish: z.boolean(),
  }).strict(),
}).strict().superRefine((state, context) => {
  if (state.activePlayerIndex >= state.players.length || state.turnEndsAt < state.turnStartedAt ||
      state.winnerOrder.some((color) => !state.players.some((p) => p.color === color)) ||
      (state.phase === "moving" && (state.diceValue === null || !state.legalTokenIndexes.length))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent game snapshot" });
  }
});

// Bound work before Zod traverses objects. PeerJS already deserializes packets;
// this limits application work, not allocations inside the transport library.
export const isBoundedPacket = (value: unknown, limit = MAX_PACKET_SIZE): boolean => {
  let budget = limit;
  let nodes = 0;
  const seen = new Set<object>();
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 4096 || depth > 12 || (budget -= 8) < 0) return false;
    if (item === null || item === undefined || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item === "string") return (budget -= item.length * 2) >= 0;
    if (typeof item !== "object" || seen.has(item)) return false;
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    seen.add(item);
    const keys = Object.keys(item);
    if (keys.length > 128) return false;
    return keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      return (budget -= key.length * 2) >= 0 && !!descriptor && "value" in descriptor && visit(descriptor.value, depth + 1);
    });
  };
  try { return visit(value, 0); } catch { return false; }
};

export const parsePacket = <T>(schema: z.ZodType<T>, raw: unknown, limit = MAX_PACKET_SIZE): T | null => {
  try {
    if (!isBoundedPacket(raw, limit)) return null;
    const result = schema.safeParse(raw);
    return result.success ? result.data : null;
  } catch { return null; }
};

export class PacketBudget {
  private at = 0;
  private count = 0;
  take(now = Date.now()): boolean {
    if (now - this.at >= 1000) { this.at = now; this.count = 0; }
    return ++this.count <= 40;
  }
}
