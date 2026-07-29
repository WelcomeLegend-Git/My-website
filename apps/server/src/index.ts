import "dotenv/config";
import http from "node:http";

import { createApp } from "./app";
import { env } from "./env";
import { logger } from "./logger";
import { setupRemoteBridgeWebSocket } from "./services/remote-bridge";
import { setupChatWebSocket } from "./services/chat-ws";
import { startMediaReaper } from "./services/media-reaper";

const app = createApp();

// Create HTTP server (needed for WebSocket upgrade)
const server = http.createServer(app);

// Setup WebSocket server for Remote Call Bridge
setupRemoteBridgeWebSocket(server);

// Setup WebSocket server for Chat
setupChatWebSocket(server);

// Start media reaper
startMediaReaper();

server.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
  logger.info(`Remote Bridge WebSocket ready on ws://localhost:${env.PORT}/ws/phone and /ws/tablet`);
});