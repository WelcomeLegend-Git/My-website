import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { env } from "../env";

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const ensureUploadDir = async () => {
  if (!fs.existsSync(env.UPLOAD_DIR)) {
    await mkdir(env.UPLOAD_DIR, { recursive: true });
  }
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export const persistFile = async (file: Express.Multer.File) => {
  await ensureUploadDir();
  const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
  const fullPath = path.join(env.UPLOAD_DIR, fileName);
  await writeFile(fullPath, file.buffer);

  return {
    url: `/uploads/${fileName}`,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};