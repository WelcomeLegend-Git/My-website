import type { RequestHandler } from "express";
import { Readable } from "node:stream";
import { google } from "googleapis";

import { createAccessToken, verifyAccessToken } from "../auth/tokens";
import { env } from "../env";
import { prisma } from "../prisma";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

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
