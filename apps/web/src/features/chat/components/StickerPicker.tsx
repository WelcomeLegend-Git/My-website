import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stickerPacks } from '../stickers';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string, packId: string) => void;
}

export function StickerPicker({ isOpen, onClose, onSelect }: StickerPickerProps) {
  const [activePackId, setActivePackId] = useState(stickerPacks[0]?.id);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-surface border border-line rounded-2xl shadow-xl overflow-hidden z-20 h-64 flex flex-col glass-card"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface/50">
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
              {stickerPacks.map(pack => (
                <button
                  key={pack.id}
                  onClick={() => setActivePackId(pack.id)}
                  className={clsx(
                    "text-xs font-medium py-1 whitespace-nowrap transition-colors",
                    activePackId === pack.id ? "text-brass border-b-2 border-brass" : "text-ink-muted hover:text-ink"
                  )}
                >
                  {pack.name}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4\">
            <div className="grid grid-cols-5 gap-2">
              {stickerPacks.find(p => p.id === activePackId)?.stickers.map(sticker => (
                <button
                  key={sticker.id}
                  onClick={() => onSelect(sticker.id, activePackId!)}
                  className="aspect-square flex items-center justify-center text-4xl hover:bg-surface-3 rounded-xl transition-colors hover:scale-110 duration-200"
                  title={sticker.label}
                >
                  {sticker.emoji}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
