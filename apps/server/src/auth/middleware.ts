import type { RequestHandler } from "express";

import { logger } from "../logger";
import { verifyAccessToken } from "./tokens";

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice("Bearer ".length);

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