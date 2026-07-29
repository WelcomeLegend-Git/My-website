import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { trpc } from '../../../lib/trpc';

export function AddContactModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: (convId: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const startConversation = trpc.chat.startConversation.useMutation();
  const utils = trpc.useUtils();

  const handleFormat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(val);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsSearching(true);
    setError('');

    try {
      // lookupInviteCode is a query, use fetch via utils
      const user = await utils.chat.lookupInviteCode.fetch({ code });
      if (user) {
        const conv = await startConversation.mutateAsync({ participantId: user.id });
        onSuccess(conv.id);
        setCode('');
      }
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || 'Failed to find contact';
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-paper/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl glass-card border border-line p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-space font-medium text-ink flex justify-between items-center mb-4">
                  Add Contact
                  <button onClick={onClose} className="text-ink-muted hover:text-ink"><X className="w-5 h-5"/></button>
                </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-ink-muted mb-2 uppercase">Invite Code</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={code}
                        onChange={handleFormat}
                        placeholder="XXXXXX"
                        className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-ink text-center font-mono text-2xl tracking-[0.5em] focus:border-brass/50 focus:outline-none transition-colors"
                        maxLength={6}
                      />
                    </div>
                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={code.length !== 6 || isSearching || startConversation.isPending}
                    className="w-full bg-brass/10 hover:bg-brass/20 text-brass border border-brass/30 rounded-xl py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSearching || startConversation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Connect</>
                    )}
                  </button>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
