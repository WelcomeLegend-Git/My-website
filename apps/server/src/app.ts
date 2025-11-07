import { createExpressMiddleware } from "@trpc/server/adapters/express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { optionalAuth } from "./auth/middleware";
import { env } from "./env";
import { logger } from "./logger";
import { persistFile, uploadMiddleware } from "./storage/local";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/root";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use("/uploads", express.static(env.UPLOAD_DIR));
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

  app.use((error: Error, _req: express.Request, res: express.Response) => {
    logger.error({ error }, "Unhandled error");
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
};