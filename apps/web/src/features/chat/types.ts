// Message types that can be sent
export type ChatMessageType = 'text' | 'sticker' | 'gif' | 'photo';

// Decrypted message payload (after client-side decryption)
export interface DecryptedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: ChatMessageType;
  content: string; // Decrypted JSON string
  mediaUrl?: string | null;
  createdAt: Date;
  isOwn: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
}

// Parsed message content (after JSON.parse of content)
export interface TextContent {
  type: 'text';
  text: string;
}

export interface StickerContent {
  type: 'sticker';
  id: string;
  pack: string;
}

export interface GifContent {
  type: 'gif';
  url: string;
  preview?: string;
  width?: number;
  height?: number;
}

export interface PhotoContent {
  type: 'photo';
  url: string;
  key: string;
  nonce: string;
  width?: number;
  height?: number;
}

export type MessageContent = TextContent | StickerContent | GifContent | PhotoContent;

// Chat identity (from server)
export interface ChatIdentity {
  id: string;
  userId: string;
  publicKey: string;
  inviteCode: string;
  displayName: string | null;
}

// Conversation with last message info
export interface ChatConversationSummary {
  id: string;
  participant: {
    id: string;
    displayName: string | null;
    publicKey: string;
    inviteCode: string;
  };
  lastMessageAt: Date | null;
  lastMessagePreview?: string;
}

// WebSocket message types (client -> server)
export type WsClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'message'; conversationId: string; ciphertext: string; nonce: string; messageType: ChatMessageType; mediaUrl?: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'read'; conversationId: string }
  | { type: 'delivered'; conversationId: string; messageIds: string[] };

// WebSocket message types (server -> client)
export type WsServerMessage =
  | { type: 'auth_ok'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'message'; id: string; conversationId: string; senderId: string; ciphertext: string; nonce: string; messageType: ChatMessageType; mediaUrl?: string | null; createdAt: string }
  | { type: 'message_ack'; id: string; conversationId: string; createdAt: string }
  | { type: 'typing'; conversationId: string; userId: string; isTyping: boolean }
  | { type: 'online'; userId: string; online: boolean }
  | { type: 'delivery_receipt'; conversationId: string; messageIds: string[]; deliveredAt: string }
  | { type: 'read_receipt'; conversationId: string; readBy: string; readAt: string }
  | { type: 'error'; message: string };

// Key pair stored locally
export interface StoredKeyPair {
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

// Vault state
export type VaultView = 'setup' | 'conversations' | 'thread';
