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

  const isVercel = process.env.VERCEL === '1';
  const isProduction = process.env.NODE_ENV === 'production';

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow localhost in development or when explicitly requested
      if (!isProduction || !origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }
      // Whitelist for production
      const whitelist = [
        "https://jee-study-web.onrender.com",
        "https://jee-study-backend.onrender.com"
      ];
      if (whitelist.some(w => origin === w || origin.endsWith(w))) {
        return callback(null, true);
      }
      // Allow the origin if it matches the WEB_APP_URL from environment
      if (process.env.WEB_APP_URL && origin === process.env.WEB_APP_URL) {
        return callback(null, true);
      }

      // Default back to reflecting the origin if not in production to be safe, 
      // but in production we want to be more explicit if possible.
      // For now, let's keep it permissive if it matches our pattern.
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allowedHeaders: ["X-Requested-With", "Content-Type", "Authorization", "Cookie", "Accept", "Origin"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  };

  // 1. CORS should be first to handle preflight OPTIONS requests immediately
  if (!isVercel) {
    app.use(cors(corsOptions));
    // Also explicitly handle OPTIONS for all routes just in case
    app.options("*", cors(corsOptions));
  }

  // 2. Helmet after CORS
  if (!isVercel) {
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // Update Content-Security-Policy to be more permissive for tRPC/CORS if needed
      contentSecurityPolicy: false 
    }));
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