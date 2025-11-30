import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart2, Battery, Cpu, HardDrive, Lock, RefreshCcw, Server, ShieldCheck, Timer, Users, X } from 'lucide-react';
import { useAdminData } from './AdminDataStore';

interface AdminDashboardProps {
  isOpen: boolean;
  isAuthorized: boolean;
  onAuthorize: (passphrase: string) => Promise<boolean>;
  onClose: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, isAuthorized, onAuthorize, onClose }) => {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const { metrics, logs, fetchMetrics, fetchLogs, isFetchingMetrics, scheduleIdleFetch } = useAdminData();

  useEffect(() => {
    if (!isOpen || !isAuthorized) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelIntervalIdle: (() => void) | undefined;
    const cancelIdle = scheduleIdleFetch(async () => {
      if (cancelled) return;
      await Promise.all([fetchMetrics(), fetchLogs()]);
      interval = setInterval(() => {
        cancelIntervalIdle?.();
        cancelIntervalIdle = scheduleIdleFetch(() => fetchMetrics(true));
      }, 5000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      cancelIntervalIdle?.();
      cancelIdle?.();
    };
  }, [isOpen, isAuthorized, fetchMetrics, fetchLogs, scheduleIdleFetch]);

  const refreshMetrics = async () => {
    await fetchMetrics(true);
  };

  const handleAuthorize = async () => {
    const ok = await onAuthorize(passphrase);
    if (!ok) {
      setError('Invalid admin passphrase.');
    } else {
      setError('');
      setPassphrase('');
    }
  };

  const logSummary = useMemo(() => {
    const recent = logs.slice(0, 10);
    return recent;
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Admin Dashboard</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Live system stats, activity logs, and alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthorized && (
              <div className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                Admin access granted
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={18} />
            </button>
          </div>
        </div>

        {!isAuthorized ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              <Lock size={18} />
              <div>
                <p className="font-medium">Admin passphrase required</p>
                <p className="text-sm text-amber-700 dark:text-amber-100/80">Enter the configured passphrase to unlock the admin dashboard.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Passphrase</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter admin passphrase"
                />
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              </div>
              <div className="flex justify-end gap-3 w-full">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuthorize}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-zinc-900 shadow-sm">
                <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-200 mb-2">
                  <span>Sessions</span>
                  <Users size={14} />
                </div>
                <p className="text-2xl font-semibold">{metrics?.sessions ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-1">Stored sessions on device</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-zinc-900 shadow-sm">
                <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-200 mb-2">
                  <span>CPU Load</span>
                  <Cpu size={14} />
                </div>
                <p className="text-2xl font-semibold">{metrics ? `${(metrics.cpu.load * 100).toFixed(1)}%` : '--'}</p>
                <p className="text-xs text-zinc-500 mt-1">{metrics?.cpu.model || 'Waiting for metrics...'}</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-zinc-900 shadow-sm">
                <div className="flex items-center justify-between text-xs text-violet-600 dark:text-violet-200 mb-2">
                  <span>Memory</span>
                  <HardDrive size={14} />
                </div>
                <p className="text-2xl font-semibold">{metrics ? `${(metrics.memory.percentUsed * 100).toFixed(1)}%` : '--'}</p>
                <p className="text-xs text-zinc-500 mt-1">{metrics ? `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}` : 'Waiting for metrics...'}</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-zinc-900 shadow-sm">
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-200 mb-2">
                  <span>Uptime</span>
                  <Timer size={14} />
                </div>
                <p className="text-2xl font-semibold">{metrics ? formatDuration(metrics.uptimeSeconds) : '--'}</p>
                <p className="text-xs text-zinc-500 mt-1">Platform: {metrics?.platform} ({metrics?.arch})</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart2 size={16} />
                  Live Metrics
                </div>
                <button
                    onClick={refreshMetrics}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <RefreshCcw size={14} /> Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                    <Cpu size={16} className="text-emerald-500" />
                    <div>
                      <div className="text-xs text-zinc-500">CPU Load (1m)</div>
                      <div className="font-semibold">{metrics ? `${(metrics.cpu.load * 100).toFixed(2)}%` : '--'}</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                    <Battery size={16} className="text-blue-500" />
                    <div>
                      <div className="text-xs text-zinc-500">Memory Free</div>
                      <div className="font-semibold">{metrics ? formatBytes(metrics.memory.free) : '--'}</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                    <Server size={16} className="text-violet-500" />
                    <div>
                      <div className="text-xs text-zinc-500">Total Memory</div>
                      <div className="font-semibold">{metrics ? formatBytes(metrics.memory.total) : '--'}</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                    <Activity size={16} className="text-amber-500" />
                    <div>
                      <div className="text-xs text-zinc-500">Updated</div>
                      <div className="font-semibold">{metrics ? new Date(metrics.timestamp).toLocaleTimeString() : '--'}</div>
                    </div>
                  </div>
                </div>
                {isFetchingMetrics && <p className="text-xs text-zinc-500 mt-2">Refreshing metrics...</p>}
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
                <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Alerts
                </div>
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="font-semibold text-amber-700 dark:text-amber-200">Security notice</p>
                    <p className="text-amber-700/80 dark:text-amber-100/80">Admin view is read-only; changes should be performed in the main workspace.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="font-semibold text-blue-700 dark:text-blue-200">Update channel</p>
                    <p className="text-blue-700/80 dark:text-blue-100/80">Check release notes before installing updates on production devices.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Activity size={16} />
                  Recent Activity
                </div>
                <span className="text-xs text-zinc-500">Showing last {logSummary.length} events</span>
              </div>
              <div className="grid grid-cols-5 text-xs font-semibold text-zinc-500 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div>Timestamp</div>
                <div>User</div>
                <div>Type</div>
                <div className="col-span-2">Message</div>
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                {logSummary.map((log) => (
                  <div key={log.id} className="grid grid-cols-5 text-sm py-3">
                    <div className="text-zinc-500">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="font-medium">{log.user}</div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          log.type === 'error'
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800'
                            : log.type === 'login'
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
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
                {logSummary.length === 0 && (
                  <div className="py-8 text-center text-sm text-zinc-500">No recent activity recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
