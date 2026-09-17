import { z } from "zod";
import { colorSchema, connectionSchema, gameStateSchema, idSchema, nameSchema, parsePacket, revisionSchema, roomCodeSchema, secretSchema, timeSchema, tokenIndexSchema } from "./validation";

export const lobbyPlayerSchema = z.object({
  name: nameSchema, color: colorSchema, isBot: z.boolean(), connection: connectionSchema, seatKey: idSchema,
}).strict();
export type HostLobbyPlayer = z.infer<typeof lobbyPlayerSchema>;
const lobbySchema = z.array(lobbyPlayerSchema).min(1).max(4).refine((players) =>
  new Set(players.map((p) => p.seatKey)).size === players.length && new Set(players.map((p) => p.color)).size === players.length);
export const resumeSchema = z.object({ seatKey: idSchema, resumeToken: secretSchema }).strict();
export type PeerResume = z.infer<typeof resumeSchema>;
const actionContext = { matchId: idSchema, expectedRevision: revisionSchema };
export const peerClientSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("join"), name: nameSchema, inviteSecret: secretSchema.nullish(), resume: resumeSchema.nullish() }).strict(),
  z.object({ t: z.literal("roll"), ...actionContext }).strict(),
  z.object({ t: z.literal("move"), tokenIndex: tokenIndexSchema, ...actionContext }).strict(),
  z.object({ t: z.literal("forfeit"), ...actionContext }).strict(),
  z.object({ t: z.literal("ping"), at: timeSchema }).strict(),
  z.object({ t: z.literal("leave") }).strict(),
]);
export type PeerClientMessage = z.infer<typeof peerClientSchema>;
export const peerHostSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("accepted"), roomCode: roomCodeSchema, seatKey: idSchema, resumeToken: secretSchema }).strict(),
  z.object({ t: z.literal("lobby"), players: lobbySchema, hostName: nameSchema, roomCode: roomCodeSchema }).strict(),
  z.object({ t: z.literal("snapshot"), state: gameStateSchema }).strict(),
  z.object({ t: z.literal("notice"), text: z.string().max(512) }).strict(),
  z.object({ t: z.literal("rejected"), text: z.string().max(512) }).strict(),
  z.object({ t: z.literal("pong"), at: timeSchema }).strict(),
]);
export type PeerHostMessage = z.infer<typeof peerHostSchema>;
export const decodePeerClientMessage = (raw: unknown): PeerClientMessage | null => parsePacket(peerClientSchema, raw, 2048);
export const decodePeerHostMessage = (raw: unknown): PeerHostMessage | null => parsePacket(peerHostSchema, raw);
