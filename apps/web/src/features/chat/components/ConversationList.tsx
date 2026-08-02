import React from 'react';
import { trpc } from '../../../lib/trpc';
import { formatDistanceToNow } from 'date-fns';
import { User } from 'lucide-react';
import clsx from 'clsx';
import { MyInviteCode } from './MyInviteCode';

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const { data: conversations, isLoading } = trpc.chat.listConversations.useQuery();

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-line">
        <MyInviteCode />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-2" />
                <div className="flex-1">
                  <div className="h-4 bg-surface-2 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-2 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations?.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-sm">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-line/50">
            {conversations?.map(conv => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={clsx(
                    "w-full p-4 flex items-center gap-4 hover:bg-surface-3 transition-colors text-left",
                    activeId === conv.id && "bg-surface-3 border-l-2 border-brass"
                  )}
                >
                  <div className="relative w-12 h-12 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-ink-muted" />
                    {/* Assuming online status is tracked elsewhere, placeholder for now */}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-signal border-2 border-paper rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-ink truncate">
                        {conv.participant.displayName || 'Unknown'}
                      </h3>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] text-ink-muted shrink-0">
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-ink-muted truncate font-mono">
                        {(conv as any).lastMessagePreview || 'New conversation'}
                      </p>
                      {((conv as any).unreadCount || 0) > 0 && (
                        <span className="bg-brass text-paper text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">
                          {(conv as any).unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
