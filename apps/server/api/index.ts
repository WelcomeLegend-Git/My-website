import "dotenv/config";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../src/app";

const app = createApp();

// Allowed origins
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://jee-studycompanion-web.vercel.app",
  "https://my-website-web.vercel.app",
];

export default async (req: VercelRequest, res: VercelResponse) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.vercel.app')
  );
  
  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie,X-Requested-With,Accept");
  res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  
  // Pass to Express app
  return app(req as any, res as any);
};
