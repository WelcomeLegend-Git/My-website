import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Smile } from 'lucide-react';
import { MessageContent } from '../types';
import { StickerPicker } from './StickerPicker';
import { GifPicker } from './GifPicker';
import { useChatMedia } from '../hooks/useChatMedia';
import { useChatIdentity } from '../hooks/useChatIdentity';
import { fromBase64 } from '../crypto/crypto';
import clsx from 'clsx';

interface ChatInputProps {
  onSend: (content: MessageContent) => void;
  onTyping: (isTyping: boolean) => void;
  conversationId: string;
  partnerPubKeyStr?: string;
}

export function ChatInput({ onSend, onTyping, conversationId, partnerPubKeyStr }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  const { sendPhoto, isUploading } = useChatMedia();
  const { keyPair } = useChatIdentity();

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    
    // Auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 80) + 'px';
    }

    // Typing indicator
    onTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1500);
  };

  const handleSendText = () => {
    if (!text.trim()) return;
    onSend({ type: 'text', text: text.trim() });
    setText('');
    onTyping(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerPubKeyStr || !keyPair) return;
    
    try {
       const partnerPubKey = fromBase64(partnerPubKeyStr);
       const content = await sendPhoto(file, conversationId, partnerPubKey, keyPair.privateKey);
       onSend(content);
    } catch (err) {
       console.error("Failed to send photo", err);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative border-t border-line bg-surface/80 backdrop-blur shrink-0 p-3">
      <StickerPicker 
        isOpen={showStickers} 
        onClose={() => setShowStickers(false)} 
        onSelect={(id, pack) => { onSend({ type: 'sticker', id, pack }); setShowStickers(false); }}
      />
      <GifPicker
        isOpen={showGifs}
        onClose={() => setShowGifs(false)}
        onSelect={(url) => { onSend({ type: 'gif', url }); setShowGifs(false); }}
      />

      <div className="flex items-end gap-2">
        <div className="flex gap-1 pb-1 shrink-0">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-3 rounded-full transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { setShowStickers(!showStickers); setShowGifs(false); }}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-3 rounded-full transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { setShowGifs(!showGifs); setShowStickers(false); }}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-3 rounded-full transition-colors font-bold text-xs font-mono flex items-center justify-center w-9"
          >
            GIF
          </button>
        </div>

        <div className="flex-1 bg-surface-2 rounded-2xl border border-line flex items-end overflow-hidden focus-within:border-brass/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Secure message..."
            className="w-full bg-transparent border-none resize-none px-4 py-3 max-h-[80px] text-sm text-ink focus:outline-none focus:ring-0"
            rows={1}
          />
        </div>

        <button
          onClick={handleSendText}
          disabled={!text.trim()}
          className={clsx(
            "p-3 rounded-full shrink-0 transition-all duration-200",
            text.trim() 
              ? "bg-brass text-paper hover:bg-brass-strong scale-100" 
              : "bg-surface-3 text-ink-muted scale-90 opacity-50 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
