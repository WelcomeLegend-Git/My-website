import { useState } from 'react';
import { compressPhoto, encryptAndUpload } from '../crypto/photo-pipeline';
import { encryptMessage } from '../crypto/crypto';
import { PhotoContent } from '../types';

export function useChatMedia() {
  const [isUploading, setIsUploading] = useState(false);

  const sendPhoto = async (
    file: File,
    conversationId: string,
    recipientPubKey: Uint8Array,
    myPrivKey: Uint8Array
  ): Promise<PhotoContent> => {
    setIsUploading(true);
    try {
      // Compress
      const photoBytes = await compressPhoto(file);
      
      // Encrypt & Upload
      const { url, key, nonce } = await encryptAndUpload(photoBytes, conversationId);
      
      // Return metadata to be sent in the message
      return {
        type: 'photo',
        url,
        key,
        nonce
      };
    } catch (error) {
      console.error('Error sending photo:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { sendPhoto, isUploading };
}
