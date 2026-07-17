import type { GameIntent, LudoGameState, LudoPlayer } from "../game/types";

export interface LudoGuestIdentity {
  guestId: string;
  sessionToken: string;
  displayName: string;
}

export type LudoClientMessage =
  | { type: "AUTH"; roomCode: string; inviteSecret?: string; identity: LudoGuestIdentity; lastRevision?: number }
  | { type: "READY"; expectedRevision: number }
  | { type: "INTENT"; intent: GameIntent; expectedRevision: number }
  | { type: "PING"; sentAt: number }
  | { type: "REJOIN"; lastRevision: number };

export type LudoServerMessage =
  | { type: "AUTHENTICATED"; player: LudoPlayer; roomCode: string; serverTime: number }
  | { type: "SNAPSHOT"; state: LudoGameState; serverTime: number }
  | { type: "PRESENCE"; players: LudoPlayer[]; serverTime: number }
  | { type: "PONG"; sentAt: number; serverTime: number }
  | { type: "ERROR"; code: "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVITE_INVALID" | "STALE_STATE" | "INVALID_ACTION" | "RATE_LIMITED"; message: string };

export const encodeLudoMessage = (message: LudoClientMessage): string => JSON.stringify(message);

export const decodeLudoMessage = (value: string): LudoServerMessage | null => {
  try {
    const message = JSON.parse(value) as Partial<LudoServerMessage>;
    return typeof message.type === "string" ? message as LudoServerMessage : null;
  } catch {
    return null;
  }
};
