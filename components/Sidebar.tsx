import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Search, Settings, Edit2, Check, X, Image as ImageIcon } from 'lucide-react';
import { Chat, StoredImageMeta, ImageRole } from '../types';

export interface GalleryImage {
  meta: StoredImageMeta;
  role: ImageRole;
  dataUri: string;
  timestamp: string;
}

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat?: (id: string) => void;
  onRenameChat?: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  galleryImages?: GalleryImage[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings,
  galleryImages = []
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const startEditing = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.chat_id);
    setEditingTitle(chat.title);
  };

  const saveEdit = (chatId: string) => {
    if (onRenameChat && editingTitle.trim()) {
      onRenameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const cancelEdit = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };
  return (
    <div className="w-64 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-md transition-colors font-medium text-sm shadow-sm"
        >
          <Plus size={16} />
          New Generation
        </button>
      </div>

      {/* Search (Mock) */}
      <div className="p-4 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-500" size={14} />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-800 dark:text-zinc-300 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.length === 0 && (
            <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm mt-10">
                No history yet. Start a new generation.
            </div>
        )}
        {chats.map((chat) => {
          const isEditing = editingChatId === chat.chat_id;

          return (
            <div
              key={chat.chat_id}
              className={`group relative flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all border ${
                currentChatId === chat.chat_id
                  ? 'bg-blue-50 dark:bg-zinc-800 border-blue-100 dark:border-zinc-700 text-blue-900 dark:text-zinc-100 font-medium'
                  : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              onClick={() => !isEditing && onSelectChat(chat.chat_id)}
            >
              <MessageSquare
                size={16}
                className={`flex-shrink-0 ${currentChatId === chat.chat_id ? 'text-blue-500 dark:text-zinc-100' : 'opacity-70'}`}
              />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(chat.chat_id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white dark:bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="text-sm truncate">{chat.title || 'Untitled Project'}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                      {new Date(chat.created_at).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEdit(chat.chat_id);
                      }}
                      className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-500 transition-all"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-500 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {onRenameChat && (
                      <button
                        onClick={(e) => startEditing(chat, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-400 hover:text-blue-500 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {onDeleteChat && chat.generation_ids.length === 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.chat_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-all"
                        title="Delete empty session"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Gallery */}
      {galleryImages.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
          <div className="p-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon size={14} className="text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Image Library</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({galleryImages.length})</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
              {galleryImages.slice(0, 40).map((img, idx) => (
                <div
                  key={`${img.meta.id}-${idx}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      meta: img.meta,
                      role: img.role,
                      dataUri: img.dataUri
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="relative aspect-square rounded border border-zinc-300 dark:border-zinc-700 overflow-hidden cursor-move hover:ring-2 hover:ring-blue-500 transition-all group"
                  title={`${img.role} image - ${new Date(img.timestamp).toLocaleDateString()}`}
                >
                  <img
                    src={img.dataUri}
                    alt={`${img.role} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${
                    img.role === 'control' ? 'bg-blue-500' :
                    img.role === 'reference' ? 'bg-purple-500' :
                    'bg-green-500'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings / Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-3 w-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
        >
          <Settings size={16} />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};