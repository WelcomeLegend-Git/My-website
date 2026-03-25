import "dotenv/config";
import http from "node:http";

import { createApp } from "./app";
import { env } from "./env";
import { logger } from "./logger";
import { setupRemoteBridgeWebSocket } from "./services/remote-bridge";

const app = createApp();

// Create HTTP server (needed for WebSocket upgrade)
const server = http.createServer(app);

// Setup WebSocket server for Remote Call Bridge
setupRemoteBridgeWebSocket(server);

server.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
  logger.info(`Remote Bridge WebSocket ready on ws://localhost:${env.PORT}/ws/phone and /ws/tablet`);
});