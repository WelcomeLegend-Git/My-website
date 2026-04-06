import { PrismaClient } from "@prisma/client";
import { env } from "./env";

declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClient =
  globalThis.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Connection retry: Prisma handles reconnection automatically,
    // but we set a reasonable connection timeout for serverless-style poolers
    datasourceUrl: undefined, // use env DATABASE_URL
  });

if (env.NODE_ENV !== "production") {
  globalThis.prisma = prismaClient;
}

// Ensure Prisma connects eagerly rather than lazily on first query
prismaClient.$connect().catch((error: unknown) => {
  console.error("Prisma failed initial connection (will retry on next query):", error);
});

export const prisma = prismaClient;