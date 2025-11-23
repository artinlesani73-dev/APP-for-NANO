import React from 'react';
import { Plus, MessageSquare, Trash2, Search } from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}) => {
  return (
    <div className="w-64 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-md transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          New Generation
        </button>
      </div>

      {/* Search (Mock) */}
      <div className="p-4 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.length === 0 && (
            <div className="text-center text-zinc-500 text-sm mt-10">
                No history yet. Start a new generation.
            </div>
        )}
        {chats.map((chat) => (
          <div
            key={chat.chat_id}
            className={`group relative flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
              currentChatId === chat.chat_id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
            onClick={() => onSelectChat(chat.chat_id)}
          >
            <MessageSquare size={16} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{chat.title || "Untitled Project"}</div>
              <div className="text-xs text-zinc-500 truncate">
                {new Date(chat.created_at).toLocaleDateString()}
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(chat.chat_id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600">
        Provenance Studio v1.0
      </div>
    </div>
  );
};
