import { z } from "zod";
import { gameStateSchema, idSchema, nameSchema, parsePacket, playerSchema, playersSchema, revisionSchema, roomCodeSchema, secretSchema, timeSchema, tokenIndexSchema, MAX_PACKET_SIZE } from "./validation";

export const guestIdentitySchema = z.object({
  guestId: idSchema, sessionToken: z.string().min(1).max(2048), displayName: nameSchema,
}).strict();
export type LudoGuestIdentity = z.infer<typeof guestIdentitySchema>;

// Engine intents include dice/time for local simulation. They must never cross the wire.
export const networkIntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROLL") }).strict(),
  z.object({ type: z.literal("MOVE"), tokenIndex: tokenIndexSchema }).strict(),
  z.object({ type: z.literal("FORFEIT") }).strict(),
]);
export type LudoNetworkIntent = z.infer<typeof networkIntentSchema>;
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("AUTH"), roomCode: roomCodeSchema, inviteSecret: secretSchema.optional(), identity: guestIdentitySchema, lastRevision: revisionSchema.optional() }).strict(),
  z.object({ type: z.literal("READY"), expectedRevision: revisionSchema }).strict(),
  z.object({ type: z.literal("INTENT"), intent: networkIntentSchema, expectedRevision: revisionSchema }).strict(),
  z.object({ type: z.literal("PING"), sentAt: timeSchema }).strict(),
  z.object({ type: z.literal("REJOIN"), lastRevision: revisionSchema }).strict(),
]);
export type LudoClientMessage = z.infer<typeof clientMessageSchema>;
export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("AUTHENTICATED"), player: playerSchema, roomCode: roomCodeSchema, serverTime: timeSchema }).strict(),
  z.object({ type: z.literal("SNAPSHOT"), state: gameStateSchema, serverTime: timeSchema }).strict(),
  z.object({ type: z.literal("PRESENCE"), players: playersSchema, serverTime: timeSchema }).strict(),
  z.object({ type: z.literal("PONG"), sentAt: timeSchema, serverTime: timeSchema }).strict(),
  z.object({ type: z.literal("ERROR"), code: z.enum(["ROOM_NOT_FOUND", "ROOM_FULL", "INVITE_INVALID", "STALE_STATE", "INVALID_ACTION", "RATE_LIMITED"]), message: z.string().max(512) }).strict(),
]);
export type LudoServerMessage = z.infer<typeof serverMessageSchema>;

export const encodeLudoMessage = (message: LudoClientMessage): string => {
  const parsed = parsePacket(clientMessageSchema, message, 8192);
  if (!parsed) throw new Error("Invalid Ludo client message.");
  return JSON.stringify(parsed);
};
export const decodeLudoMessage = (value: string): LudoServerMessage | null => {
  if (typeof value !== "string" || value.length > MAX_PACKET_SIZE) return null;
  try { return parsePacket(serverMessageSchema, JSON.parse(value)); } catch { return null; }
};
