import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any;

export default async (req: VercelRequest, res: VercelResponse) => {
  // Set CORS headers FIRST before anything else and before importing the app
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
  const reqHeaders = (req.headers["access-control-request-headers"] as string) ||
    "X-Requested-With,Content-Type,Authorization,Cookie,Accept,Origin";
  const reqMethod = (req.headers["access-control-request-method"] as string) ||
    "GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD";

  res.setHeader("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", reqMethod);
  res.setHeader("Access-Control-Allow-Headers", reqHeaders);
  res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight immediately
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Lightweight health without importing the full app
  if (req.url && req.url.startsWith("/health")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", time: Date.now() }));
    return;
  }

  // Lazily import and initialize the app only for non-preflight requests
  if (!app) {
    try {
      const mod = await import("../src/app");
      app = mod.createApp();
    } catch (error: any) {
      // Surface the error to help diagnose env/config problems
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "APP_INIT_FAILED",
          message: error?.message ?? "Unknown error",
        })
      );
      return;
    }
  }

  // Pass to Express app
  return app(req as any, res as any);
};
