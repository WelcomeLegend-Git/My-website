import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import clsx from 'clsx';
import { DecryptedMessage, MessageContent } from '../types';
import { getStickerById } from '../stickers';
import { Loader2, Image as ImageIcon, Check, CheckCheck, Clock } from 'lucide-react';

export function MessageBubble({ message, partnerPublicKey }: { message: DecryptedMessage; partnerPublicKey?: string }) {
  const [content, setContent] = useState<MessageContent | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(message.content) as MessageContent;
      setContent(parsed);

      if (parsed.type === 'photo') {
        if (message.mediaUrl) {
          setPhotoDataUrl(message.mediaUrl);
        } else {
          setPhotoError(true);
        }
      }
    } catch {
      setContent({ type: 'text', text: message.content });
    }
  }, [message.content, message.mediaUrl]);

  const isOwn = message.isOwn;
  const isFailed = message.id.startsWith('failed-');
  const isPending = message.id.startsWith('temp-');

  if (!content) return null;

  // Triple-tick logic for own messages:
  // - Clock icon = pending (temp- id, not yet saved to server)
  // - ✓ gray = saved to server (has real id, no deliveredAt)
  // - ✓✓ gray = delivered to recipient device (has deliveredAt, no readAt)
  // - ✓✓ blue = seen by recipient (has readAt)
  const renderTicks = () => {
    if (!isOwn) return null;

    if (isFailed) {
      return <span className="text-[9px] text-red-500 font-mono">Failed</span>;
    }
    if (isPending) {
      return <Clock className="w-3 h-3 text-ink-muted/50" />;
    }
    if (message.readAt) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    if (message.deliveredAt) {
      return <CheckCheck className="w-3 h-3 text-ink-muted" />;
    }
    return <Check className="w-3 h-3 text-ink-muted" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "max-w-[75%] flex flex-col",
        isOwn ? "self-end items-end" : "self-start items-start"
      )}
    >
      <div
        className={clsx(
          "px-4 py-2.5 rounded-2xl relative group",
          isOwn
            ? "bg-brass/20 text-brass border border-brass/30 rounded-tr-sm"
            : "bg-surface-2 text-ink border border-line rounded-tl-sm",
          isFailed && "opacity-50"
        )}
      >
        {content.type === 'text' && (
          <p className="whitespace-pre-wrap break-words text-sm">{content.text}</p>
        )}

        {content.type === 'sticker' && (
          <div className="text-6xl leading-none py-2">
            {getStickerById(content.id)?.emoji || '❓'}
          </div>
        )}

        {content.type === 'gif' && (
          <img src={content.url} alt="GIF" className="rounded-lg max-w-full h-auto" loading="lazy" />
        )}

        {content.type === 'photo' && (
          <div className="relative min-w-[150px] min-h-[150px] flex items-center justify-center bg-surface-3 rounded-lg overflow-hidden">
            {photoDataUrl ? (
               <img src={photoDataUrl} alt="Photo" className="max-w-full h-auto rounded-lg object-cover" />
            ) : photoError ? (
               <div className="text-ink-muted text-xs flex flex-col items-center gap-2 p-4 text-center">
                 <ImageIcon className="w-6 h-6 opacity-50" />
                 Photo expired or unavailable
               </div>
            ) : (
               <Loader2 className="w-6 h-6 text-brass animate-spin" />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1 mt-1 px-1">
        <span className="text-[9px] text-ink-muted font-mono">
          {format(message.createdAt, 'HH:mm')}
        </span>
        {renderTicks()}
      </div>
    </motion.div>
  );
}
