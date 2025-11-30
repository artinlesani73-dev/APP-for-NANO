import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, X, RefreshCw, Lock } from 'lucide-react';
import { LoggerService } from '../services/logger';
import { AppConfig } from '../services/config';
import { useAdminDataStore } from './AdminDataProvider';
import { cancelIdleTask, scheduleIdleTask } from './idleUtils';

interface AdminLogsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLogs: React.FC<AdminLogsProps> = ({ isOpen, onClose }) => {
  const [authorized, setAuthorized] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { activityLogs, setActivityLogs, lastFetchedAt, updateLastFetchedAt } = useAdminDataStore();

  const adminPassphrase = AppConfig.getAdminPassphrase();

  useEffect(() => {
    if (!isOpen) {
      setAuthorized(false);
      setPassphrase('');
      setError('');
      setUserFilter('');
      setStartDate('');
      setEndDate('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!authorized || !isOpen) return;

    let cancelled = false;
    let idleHandle: number | null = null;

    const refreshLogs = async () => {
      if (cancelled) return;
      const fetched = await LoggerService.fetchLogs();
      if (cancelled) return;
      setActivityLogs(fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      updateLastFetchedAt(Date.now());
    };

    idleHandle = scheduleIdleTask(() => {
      if (cancelled) return;
      const shouldFetch = !lastFetchedAt || Date.now() - lastFetchedAt > 30000 || activityLogs.length === 0;
      if (shouldFetch) {
        void refreshLogs();
      }
    }, 300);

    return () => {
      cancelled = true;
      if (idleHandle) cancelIdleTask(idleHandle);
    };
  }, [authorized, isOpen, activityLogs.length, lastFetchedAt, setActivityLogs, updateLastFetchedAt]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchesUser = userFilter ? log.user.toLowerCase().includes(userFilter.toLowerCase()) : true;
      const time = new Date(log.timestamp).getTime();
      const afterStart = startDate ? time >= new Date(startDate).getTime() : true;
      const beforeEnd = endDate ? time <= new Date(endDate).getTime() : true;
      return matchesUser && afterStart && beforeEnd;
    });
  }, [activityLogs, userFilter, startDate, endDate]);

  const handleAuthorize = () => {
    if (!adminPassphrase) {
      setError('Admin passphrase is not configured.');
      return;
    }
    if (passphrase.trim() === adminPassphrase) {
      setAuthorized(true);
      setError('');
      LoggerService.logAction('Admin console unlocked');
      LoggerService.flush();
    } else {
      setError('Invalid passphrase.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Admin Logs</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Audit key events, actions, and errors</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {!authorized ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              <Lock size={18} />
              <div>
                <p className="font-medium">Admin access required</p>
                <p className="text-sm text-amber-700 dark:text-amber-200/80">Enter the configured passphrase to view logs locally stored on this device.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Admin Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter passphrase"
              />
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorize}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Unlock
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Filter by user</label>
                  <input
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Start time</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">End time</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const fetched = await LoggerService.fetchLogs();
                    setActivityLogs(fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
                    updateLastFetchedAt(Date.now());
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 px-4 py-2 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                <div>Timestamp</div>
                <div>User</div>
                <div>Type</div>
                <div className="col-span-2">Message</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredLogs.length === 0 && (
                  <div className="p-6 text-center text-sm text-zinc-500">No log entries match the current filters.</div>
                )}
                {filteredLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-5 px-4 py-3 text-sm">
                    <div className="text-zinc-500">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="font-medium">
                      <div>{log.user}</div>
                      {log.userId && (
                        <div className="text-[11px] text-zinc-500">ID: {log.userId}</div>
                      )}
                    </div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          log.type === 'error'
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800'
                            : log.type === 'login'
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-green-200 dark:border-green-800'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {log.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-2 text-zinc-700 dark:text-zinc-200">
                      <div>{log.message}</div>
                      {log.context && (
                        <pre className="mt-1 text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 p-2 rounded-lg overflow-x-auto">{JSON.stringify(log.context, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
