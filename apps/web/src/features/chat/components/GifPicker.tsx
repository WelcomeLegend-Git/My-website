import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function GifPicker({ isOpen, onClose }: GifPickerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-surface border border-line rounded-2xl shadow-xl overflow-hidden z-20 h-72 flex flex-col glass-card"
        >
          <div className="p-3 border-b border-line flex items-center gap-2 bg-surface/50">
             <div className="flex-1 relative">
               <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
               <input 
                 type="text" 
                 placeholder="Search Tenor..." 
                 className="w-full bg-surface-3 border-none rounded-lg pl-9 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass/50"
               />
             </div>
             <button onClick={onClose} className="p-2 text-ink-muted hover:text-ink shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-ink-muted">
             <p className="text-sm">GIF search coming soon!</p>
             <p className="text-xs mt-2 max-w-[200px]">Use your keyboard's GIF feature (Gboard) to send GIFs, or paste a GIF URL in the input.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
