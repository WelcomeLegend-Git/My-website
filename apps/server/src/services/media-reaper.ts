import { createClient } from "@supabase/supabase-js";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { env } from "../env";

const REAPER_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
const MAX_AGE_DAYS = 7;
const BUCKET_NAME = "encrypted-media";

/**
 * Start the media reaper job.
 * Runs every 6 hours, deletes encrypted photo blobs older than 7 days.
 */
export function startMediaReaper(): void {
  logger.info("Media reaper started (runs every 6 hours, deletes photos > 7 days old)");

  // Run once on startup (after a short delay)
  setTimeout(() => reapExpiredMedia().catch((e) => logger.error({ e }, "Reaper startup run failed")), 30_000);

  // Then every 6 hours
  setInterval(() => {
    reapExpiredMedia().catch((e) => logger.error({ e }, "Reaper interval run failed"));
  }, REAPER_INTERVAL_MS);
}

async function reapExpiredMedia(): Promise<void> {
  const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  logger.info({ cutoffDate: cutoffDate.toISOString() }, "Running media reaper");

  // Find photo messages older than 7 days that still have a mediaUrl
  const expiredMessages = await prisma.chatMessage.findMany({
    where: {
      messageType: "photo",
      mediaUrl: { not: null },
      createdAt: { lt: cutoffDate },
    },
    select: {
      id: true,
      mediaUrl: true,
    },
  });

  if (expiredMessages.length === 0) {
    logger.info("No expired media to clean up");
    return;
  }

  logger.info({ count: expiredMessages.length }, "Found expired media to clean up");

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let deletedCount = 0;
  let errorCount = 0;

  for (const msg of expiredMessages) {
    try {
      if (msg.mediaUrl) {
        // Extract the file path from the URL
        // URL format: https://<supabase-url>/storage/v1/object/public/encrypted-media/chat/<convId>/<uuid>.enc
        const urlObj = new URL(msg.mediaUrl);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/encrypted-media\/(.+)/);
        const filePath = pathMatch?.[1];

        if (filePath) {
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

          if (error) {
            logger.warn({ error, filePath }, "Failed to delete blob from storage");
          }
        }
      }

      // Set mediaUrl to null (message stays, but shows "Photo expired")
      await prisma.chatMessage.update({
        where: { id: msg.id },
        data: { mediaUrl: null },
      });

      deletedCount++;
    } catch (err) {
      errorCount++;
      logger.error({ err, messageId: msg.id }, "Failed to reap media");
    }
  }

  logger.info({ deletedCount, errorCount }, "Media reaper completed");
}
