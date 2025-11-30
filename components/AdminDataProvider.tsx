import React, { createContext, useContext, useMemo, useState } from 'react';
import { AdminMetrics, LogEntry } from '../types';

type AdminDataContextValue = {
  metrics: AdminMetrics | null;
  activityLogs: LogEntry[];
  lastFetchedAt: number | null;
  setMetrics: (payload: AdminMetrics | null) => void;
  setActivityLogs: (logs: LogEntry[]) => void;
  updateLastFetchedAt: (timestamp: number | null) => void;
};

const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const value = useMemo(
    () => ({ metrics, activityLogs, lastFetchedAt, setMetrics, setActivityLogs, updateLastFetchedAt: setLastFetchedAt }),
    [metrics, activityLogs, lastFetchedAt]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
};

export const useAdminDataStore = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error('useAdminDataStore must be used within an AdminDataProvider');
  }
  return ctx;
};
