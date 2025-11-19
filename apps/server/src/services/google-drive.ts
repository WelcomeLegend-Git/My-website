import type { RequestHandler } from "express";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { google } from "googleapis";

import { createAccessToken, verifyAccessToken } from "../auth/tokens";
import { env } from "../env";
import { prisma } from "../prisma";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

type BackupPayloadV1 = {
  version: 1;
  exportedAt: string | Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string | Date;
  };
  data: {
    subjects: any[];
    chapters: any[];
    formulas: any[];
    formulaAssets: any[];
    mistakes: any[];
    mistakeAssets: any[];
    quizSessions: any[];
    quizQuestions: any[];
    practiceQuizzes: any[];
    practiceQuestions: any[];
    practiceAttempts: any[];
    formulaCollections: any[];
  };
};

const getOAuthClient = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URL) {
    throw new Error("Google OAuth is not configured");
  }

  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URL);
};

export const buildGoogleAuthUrl = (params: { userId: string; email: string }) => {
  const client = getOAuthClient();

  const stateToken = createAccessToken({ sub: params.userId, email: params.email });

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    prompt: "consent",
    state: stateToken,
  });

  return url;
};

export const completeGoogleOAuth = async (code: string, stateToken: string) => {
  const payload = verifyAccessToken(stateToken);
  const userId = payload.sub;

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Please ensure 'offline' access is enabled.");
  }

  const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await prisma.googleDriveConnection.upsert({
    where: { userId },
    create: {
      userId,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      expiryDate,
    },
    update: {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      expiryDate,
    },
  });

  return { userId };
};

export const uploadBackupToDrive = async (userId: string, backup: unknown) => {
  const connection = await prisma.googleDriveConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new Error("Google Drive is not connected for this user");
  }

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: connection.refreshToken,
    access_token: connection.accessToken ?? undefined,
  });

  const drive = google.drive({ version: "v3", auth: client });

  let folderId = connection.folderId ?? undefined;
  if (!folderId) {
    const folderResponse = await drive.files.create({
      requestBody: {
        name: "JEE Companion Backups",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    folderId = folderResponse.data.id ?? undefined;
    if (!folderId) {
      throw new Error("Failed to create backup folder in Google Drive");
    }

    await prisma.googleDriveConnection.update({
      where: { userId },
      data: { folderId },
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `jee-companion-backup-${timestamp}.json`;

  const media = {
    mimeType: "application/json",
    body: Readable.from([JSON.stringify(backup)]),
  };

  const fileResponse = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media,
    fields: "id, webViewLink, name",
  });

  const backedUpAt = new Date();

  await prisma.googleDriveConnection.update({
    where: { userId },
    data: { lastBackupAt: backedUpAt },
  });

  return {
    fileId: fileResponse.data.id ?? null,
    webViewLink: fileResponse.data.webViewLink ?? null,
    name: fileResponse.data.name ?? fileName,
    backedUpAt,
  };
};

const ensureBackupFolder = async (userId: string) => {
  const connection = await prisma.googleDriveConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new Error("Google Drive is not connected for this user");
  }

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: connection.refreshToken,
    access_token: connection.accessToken ?? undefined,
  });

  const drive = google.drive({ version: "v3", auth: client });

  let folderId = connection.folderId ?? undefined;
  if (!folderId) {
    const folderResponse = await drive.files.create({
      requestBody: {
        name: "JEE Companion Backups",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    folderId = folderResponse.data.id ?? undefined;
    if (!folderId) {
      throw new Error("Failed to create backup folder in Google Drive");
    }

    await prisma.googleDriveConnection.update({
      where: { userId },
      data: { folderId },
    });
  }

  return { connection, client, drive, folderId } as const;
};

export const downloadLatestBackupFromDrive = async (userId: string): Promise<BackupPayloadV1> => {
  const { drive, folderId } = await ensureBackupFolder(userId);

  const listResponse = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: "createdTime desc",
    pageSize: 1,
    fields: "files(id, name, createdTime)",
  });

  const file = listResponse.data.files?.[0];
  if (!file || !file.id) {
    throw new Error("No backups found in Google Drive for this account");
  }

  const downloadResponse = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "stream" },
  );

  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    (downloadResponse.data as unknown as NodeJS.ReadableStream)
      .on("data", (chunk: Uint8Array) => chunks.push(chunk))
      .on("end", () => resolve())
      .on("error", (error) => reject(error));
  });

  const json = Buffer.concat(chunks).toString("utf-8");
  const parsed = JSON.parse(json) as BackupPayloadV1;

  if (parsed.version !== 1) {
    throw new Error("Unsupported backup version. Please update the app before restoring.");
  }

  return parsed;
};

export const restoreLatestBackupForUser = async (userId: string) => {
  const backup = await downloadLatestBackupFromDrive(userId);

  if (backup.user.id !== userId) {
    throw new Error("This backup was created for a different account and cannot be restored here.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.deleteMany({
      where: {
        session: {
          ownerId: userId,
        },
      },
    });

    await tx.quizSession.deleteMany({ where: { ownerId: userId } });

    await tx.practiceQuestion.deleteMany({
      where: {
        quiz: {
          ownerId: userId,
        },
      },
    });

    await tx.practiceAttempt.deleteMany({ where: { userId } });
    await tx.practiceQuiz.deleteMany({ where: { ownerId: userId } });

    await tx.formulaAsset.deleteMany({
      where: {
        formula: {
          ownerId: userId,
        },
      },
    });

    await tx.mistakeAsset.deleteMany({
      where: {
        mistake: {
          ownerId: userId,
        },
      },
    });

    await tx.formula.deleteMany({ where: { ownerId: userId } });
    await tx.mistake.deleteMany({ where: { ownerId: userId } });
    await tx.formulaCollection.deleteMany({ where: { ownerId: userId } });

    await tx.chapter.deleteMany({
      where: {
        subject: {
          ownerId: userId,
        },
      },
    });

    await tx.subject.deleteMany({ where: { ownerId: userId } });

    const {
      subjects,
      chapters,
      formulas,
      formulaAssets,
      mistakes,
      mistakeAssets,
      quizSessions,
      quizQuestions,
      practiceQuizzes,
      practiceQuestions,
      practiceAttempts,
      formulaCollections,
    } = backup.data;

    if (subjects.length) {
      await tx.subject.createMany({ data: subjects });
    }
    if (chapters.length) {
      await tx.chapter.createMany({ data: chapters });
    }
    if (formulaCollections.length) {
      await tx.formulaCollection.createMany({ data: formulaCollections });
    }
    if (formulas.length) {
      await tx.formula.createMany({ data: formulas });
    }
    if (mistakes.length) {
      await tx.mistake.createMany({ data: mistakes });
    }
    if (formulaAssets.length) {
      await tx.formulaAsset.createMany({ data: formulaAssets });
    }
    if (mistakeAssets.length) {
      await tx.mistakeAsset.createMany({ data: mistakeAssets });
    }
    if (quizSessions.length) {
      await tx.quizSession.createMany({ data: quizSessions });
    }
    if (quizQuestions.length) {
      await tx.quizQuestion.createMany({ data: quizQuestions });
    }
    if (practiceQuizzes.length) {
      await tx.practiceQuiz.createMany({ data: practiceQuizzes });
    }
    if (practiceQuestions.length) {
      await tx.practiceQuestion.createMany({ data: practiceQuestions });
    }
    if (practiceAttempts.length) {
      await tx.practiceAttempt.createMany({ data: practiceAttempts });
    }
  });

  return {
    restoredAt: new Date(),
    backupExportedAt: backup.exportedAt,
  };
};

export const handleGoogleDriveOAuthCallback: RequestHandler = async (req, res) => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  const baseUrl = env.WEB_APP_URL ?? "";
  const target = baseUrl ? `${baseUrl}/settings` : "/";

  if (error || !code || !state) {
    return res.redirect(target);
  }

  try {
    await completeGoogleOAuth(code, state);
  } catch {
    return res.redirect(target);
  }

  return res.redirect(target);
};
