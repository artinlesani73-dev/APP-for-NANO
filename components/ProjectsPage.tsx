import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Trash2, Download, ArrowLeft } from 'lucide-react';
import { MixboardSession } from '../types';
import { StorageService } from '../services/newStorageService';

interface ProjectsPageProps {
  theme: 'dark' | 'light';
  sessions: MixboardSession[];
  onSelectSession: (sessionId: string) => void;
  onClose: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  theme,
  sessions,
  onSelectSession,
  onClose,
  onDeleteSession
}) => {
  const [sortedSessions, setSortedSessions] = useState<MixboardSession[]>([]);

  useEffect(() => {
    // Sort sessions by updated_at (most recent first)
    const sorted = [...sessions].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    setSortedSessions(sorted);
  }, [sessions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const handleExportSession = (session: MixboardSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = JSON.stringify(session, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mixboard-session-${session.session_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteSession = (session: MixboardSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((session.generations ?? []).length > 0) {
      alert('Cannot delete session with generations. Please clear the session first.');
      return;
    }
    if (window.confirm(`Delete session "${session.title}"?`)) {
      onDeleteSession(session.session_id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Projects</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Manage all your Mixboard sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {sortedSessions.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                No projects yet
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                Create your first Mixboard session to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Created
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Last Updated
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Generations
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Items
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map(session => (
                    <tr
                      key={session.session_id}
                      onClick={() => {
                        onSelectSession(session.session_id);
                        onClose();
                      }}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <FileText className="text-orange-600 dark:text-orange-400" size={18} />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {session.title}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-500">
                              ID: {session.session_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {formatDate(session.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatDate(session.updated_at)}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {(session.generations ?? []).length}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {(session.canvas_images ?? []).length}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleExportSession(session, e)}
                            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                            title="Export session"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(session, e)}
                            className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                            title="Delete session"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
