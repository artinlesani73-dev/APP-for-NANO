import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AdminService } from '../services/adminService';
import { LoggerService } from '../services/logger';
import { AdminMetrics, LogEntry } from '../types';

const IDLE_TIMEOUT_MS = 250;
const METRIC_THROTTLE_MS = 5000;
const LOG_THROTTLE_MS = 15000;

const runWhenIdle = (fn: () => void) => {
  if (typeof window === 'undefined') return () => undefined;

  if ('requestIdleCallback' in window) {
    const idleId = (window as any).requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
    return () => (window as any).cancelIdleCallback?.(idleId);
  }

  const timeout = setTimeout(fn, IDLE_TIMEOUT_MS);
  return () => clearTimeout(timeout);
};

interface AdminDataContextValue {
  metrics: AdminMetrics | null;
  logs: LogEntry[];
  isFetchingMetrics: boolean;
  isFetchingLogs: boolean;
  fetchMetrics: (force?: boolean) => Promise<AdminMetrics | null>;
  fetchLogs: (force?: boolean) => Promise<LogEntry[]>;
  scheduleIdleFetch: (fn: () => void) => () => void;
}

const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  const lastMetricsFetchRef = useRef<number | null>(null);
  const lastLogsFetchRef = useRef<number | null>(null);
  const metricsRef = useRef<AdminMetrics | null>(null);
  const logsRef = useRef<LogEntry[]>([]);

  const fetchMetrics = useCallback(async (force = false) => {
    if (isFetchingMetrics) return metricsRef.current;
    if (!force && lastMetricsFetchRef.current && Date.now() - lastMetricsFetchRef.current < METRIC_THROTTLE_MS) {
      return metricsRef.current;
    }

    setIsFetchingMetrics(true);
    const payload = await AdminService.fetchMetrics();
    setMetrics(payload);
    metricsRef.current = payload;
    lastMetricsFetchRef.current = Date.now();
    setIsFetchingMetrics(false);
    return payload;
  }, [isFetchingMetrics]);

  const fetchLogs = useCallback(async (force = false) => {
    if (isFetchingLogs) return logsRef.current;
    if (!force && lastLogsFetchRef.current && Date.now() - lastLogsFetchRef.current < LOG_THROTTLE_MS) {
      return logsRef.current;
    }

    setIsFetchingLogs(true);
    const fetched = await LoggerService.fetchLogs();
    const sorted = fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(sorted);
    logsRef.current = sorted;
    lastLogsFetchRef.current = Date.now();
    setIsFetchingLogs(false);
    return sorted;
  }, [isFetchingLogs]);

  const value = useMemo(() => ({
    metrics,
    logs,
    isFetchingMetrics,
    isFetchingLogs,
    fetchMetrics,
    fetchLogs,
    scheduleIdleFetch: runWhenIdle
  }), [metrics, logs, isFetchingMetrics, isFetchingLogs, fetchMetrics, fetchLogs]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
};

export const useAdminData = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used within an AdminDataProvider');
  return ctx;
};
