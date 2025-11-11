import { createExpressMiddleware } from "@trpc/server/adapters/express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { optionalAuth } from "./auth/middleware";
import { logger } from "./logger";
import { persistFile, uploadMiddleware } from "./storage/supabase";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/root";

export const createApp = () => {
  const app = express();

  // Disable helmet in Vercel as we handle CORS manually in api/index.ts
  const isVercel = process.env.VERCEL === '1';
  
  if (!isVercel) {
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
  }
  
  // Only apply CORS middleware when not on Vercel
  // On Vercel, CORS is handled in api/index.ts
  if (!isVercel) {
    // Handle preflight requests
    app.options("*", cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:5173",
        /\.vercel\.app$/,
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    }));
    
    app.use(
      cors({
        origin: [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003",
          "http://localhost:5173",
          /\.vercel\.app$/,
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      })
    );
  }
  
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use(optionalAuth);

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