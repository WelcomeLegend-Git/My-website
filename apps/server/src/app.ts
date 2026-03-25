import { createExpressMiddleware } from "@trpc/server/adapters/express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";

import { optionalAuth } from "./auth/middleware";
import { logger } from "./logger";
import { handleGoogleDriveOAuthCallback } from "./services/google-drive";
import { persistFile, uploadMiddleware } from "./storage/supabase";
import { setupRemoteBridgeRoutes } from "./services/remote-bridge";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/root";

export const createApp = () => {
  const app = express();

  // Disable helmet in Vercel as we handle CORS manually in api/index.ts
  const isVercel = process.env.VERCEL === '1';

  const corsOptions: CorsOptions = {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  };

  if (!isVercel) {
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
  }
  
  // Only apply CORS middleware when not on Vercel
  // On Vercel, CORS is handled in api/index.ts
  if (!isVercel) {
    // Handle preflight requests with shared CORS options
    app.options("*", cors(corsOptions));

    // Apply CORS for all routes
    app.use(cors(corsOptions));
  }
  
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use(optionalAuth);

  app.get("/api/google-drive/callback", handleGoogleDriveOAuthCallback);

  app.post(
    "/api/uploads",
    uploadMiddleware.single("file"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }
        const stored = await persistFile(req.file);
        return res.status(201).json(stored);
      } catch (error) {
        logger.error({ error }, "Failed to persist file");
        return next(error);
      }
    }
  );

  // Remote Call Bridge REST API
  setupRemoteBridgeRoutes(app);

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path }) {
        logger.error({ error, type, path }, "tRPC error");
      },
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ error }, "Unhandled error");
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
};