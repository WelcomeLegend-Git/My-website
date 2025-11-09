import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";

let app: Express | null = null;

const ensureApp = async (): Promise<Express> => {
  if (app) {
    return app;
  }

  const mod = await import("../app");
  app = mod.createApp();
  return app;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
  const reqHeaders =
    (req.headers["access-control-request-headers"] as string) ||
    "X-Requested-With,Content-Type,Authorization,Cookie,Accept,Origin";
  const reqMethod =
    (req.headers["access-control-request-method"] as string) || "GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD";

  res.setHeader("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", reqMethod);
  res.setHeader("Access-Control-Allow-Headers", reqHeaders);
  res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.url && req.url.startsWith("/health")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", time: Date.now() }));
    return;
  }

  try {
    const instance = await ensureApp();
    instance(req as unknown as Parameters<Express>[0], res as unknown as Parameters<Express>[1]);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        error: "APP_INIT_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack ?? null : null,
      }),
    );
  }
};

export default handler;
