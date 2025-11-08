import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (Supabase free tier)
  },
});

export const persistFile = async (file: Express.Multer.File) => {
  const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
  
  const { data, error } = await supabaseAdmin.storage
    .from("mistake-uploads")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from("mistake-uploads")
    .getPublicUrl(data.path);

  return {
    id: data.id ?? data.path,
    path: data.path,
    url: urlData.publicUrl,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};
