import type { RequestHandler } from "express";

import { logger } from "../logger";
import { verifyAccessToken } from "./tokens";

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice("Bearer ".length);

  // Handle guest tokens
  if (token.startsWith("guest_token_")) {
    // Extract guest ID from token (format: guest_token_timestamp)
    const guestId = `guest_${token.split("_")[2]}`;
    (req as typeof req & { user?: { id: string; email: string } }).user = {
      id: guestId,
      email: `${guestId}@guest.local`,
    };
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    (req as typeof req & { user?: { id: string; email: string } }).user = {
      id: payload.sub,
      email: payload.email,
    };
  } catch (error) {
    logger.warn({ error }, "Invalid access token");
  }

  return next();
};