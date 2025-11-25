import { AdminMetrics, LogEntry } from '../types';

const electronApi = (typeof window !== 'undefined' && (window as any).electron) || undefined;

export const AdminService = {
  async verifyPassphrase(candidate: string): Promise<boolean> {
    if (!electronApi?.verifyAdminPassphrase) return false;
    return electronApi.verifyAdminPassphrase(candidate);
  },

  async openAdminWindow(verified: boolean): Promise<boolean> {
    if (!electronApi?.openAdminWindow) return false;
    return electronApi.openAdminWindow(verified);
  },

  async fetchMetrics(): Promise<AdminMetrics | null> {
    if (!electronApi?.getAdminMetrics) return null;
    return electronApi.getAdminMetrics();
  },

  async fetchActivityLogs(): Promise<LogEntry[]> {
    if (!electronApi?.fetchLogs) return [];
    const logs: LogEntry[] = await electronApi.fetchLogs();
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};
