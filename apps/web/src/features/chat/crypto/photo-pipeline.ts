import { supabase } from '../../../lib/supabase';
import { encryptMedia, decryptMedia, toBase64 } from './crypto';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 500 * 1024; // 500 KB
const BUCKET_NAME = 'encrypted-media';

/**
 * Compress a photo using HTML5 Canvas API.
 * Resizes to max 1600px on longest side, outputs JPEG at 0.8 quality.
 */
export async function compressPhoto(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Scale down if needed
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try decreasing quality if file is too large
      let quality = JPEG_QUALITY;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            if (blob.size > MAX_FILE_SIZE && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
              return;
            }
            
            blob.arrayBuffer().then((buf) => {
              resolve(new Uint8Array(buf));
            }).catch(reject);
          },
          'image/jpeg',
          quality
        );
      };
      
      tryCompress();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Encrypt compressed photo bytes and upload to Supabase Storage.
 * Returns the storage URL and the symmetric key + nonce for decryption.
 */
export async function encryptAndUpload(
  photoBytes: Uint8Array,
  conversationId: string
): Promise<{ url: string; key: string; nonce: string }> {
  const { encryptedBytes, key, nonce } = encryptMedia(photoBytes);
  
  const fileName = `chat/${conversationId}/${crypto.randomUUID()}.enc`;
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, encryptedBytes, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
  
  if (error) {
    throw new Error(`Failed to upload encrypted photo: ${error.message}`);
  }
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);
  
  return {
    url: urlData.publicUrl,
    key,
    nonce,
  };
}

/**
 * Download an encrypted photo blob from Supabase Storage and decrypt it.
 * Returns a blob URL that can be used as an <img> src.
 */
export async function downloadAndDecrypt(
  url: string,
  keyB64: string,
  nonceB64: string
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download encrypted photo');
  }
  
  const encryptedBytes = new Uint8Array(await response.arrayBuffer());
  const decrypted = decryptMedia(encryptedBytes, keyB64, nonceB64);
  
  // @ts-expect-error ArrayBufferLike / SharedArrayBuffer incompatibility
  const blob = new Blob([decrypted.buffer], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Get dimensions of an image file without loading the full image.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}
