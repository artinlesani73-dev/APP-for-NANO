import { AppConfig } from './config';
import { LogEntry, LogEventType } from '../types';

const LOG_STORAGE_KEY = 'nano_event_logs';
const MAX_LOCAL_LOGS = 500;
const FLUSH_INTERVAL_MS = 5000;

const isElectron = () => typeof window !== 'undefined' && !!window.electron;

const loadLocalLogs = (): LogEntry[] => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as LogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistLocalLogs = (logs: LogEntry[]) => {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOCAL_LOGS)));
  } catch {
    // ignore storage errors
  }
};

declare global {
  interface Window {
    electron?: {
      saveSync?: (filename: string, content: string) => boolean;
      loadSync?: (filename: string) => string | null;
      deleteSync?: (filename: string) => boolean;
      listFilesSync?: (prefix: string) => Array<{ key: string; content: string }>;
      saveImageSync?: (folder: string, filename: string, base64Data: string) => { success: boolean; path?: string; error?: string };
      loadImageSync?: (folder: string, filename: string) => string | null;
      exportImageSync?: (folder: string, filename: string) => { success: boolean; path?: string; cancelled?: boolean; error?: string };
      listSessionsSync?: () => any[];
      saveSessionSync?: (sessionId: string, sessionData: any) => { success: boolean; error?: string };
      loadSessionSync?: (sessionId: string) => any;
      deleteSessionSync?: (sessionId: string) => { success: boolean; error?: string };
      logEvent?: (entry: LogEntry) => void;
      fetchLogs?: () => Promise<LogEntry[]>;
      setUserContext?: (user: { displayName: string; id?: string } | null) => void;
    };
  }
}

class Logger {
  private buffer: LogEntry[] = [];
  private flushTimer?: number;
  private currentUser: { displayName: string; id?: string } | null = null;

  init() {
    if (typeof window === 'undefined') return;
    if (this.flushTimer) return;
    this.flushTimer = window.setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  setCurrentUser(user: { displayName: string; id?: string } | null) {
    this.currentUser = user;
    if (isElectron()) {
      try {
        window.electron?.setUserContext?.(user);
      } catch (err) {
        console.error('Failed to sync user context to main process', err);
      }
    }
  }

  logEvent(type: LogEventType, message: string, context?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: this.currentUser?.displayName || 'anonymous',
      userId: this.currentUser?.id,
      type,
      message,
      context,
    };

    const existing = loadLocalLogs();
    const updated = [entry, ...existing].slice(0, MAX_LOCAL_LOGS);
    persistLocalLogs(updated);

    this.buffer.push(entry);
  }

  logLogin(message: string, context?: Record<string, unknown>) {
    this.logEvent('login', message, context);
  }

  logAction(message: string, context?: Record<string, unknown>) {
    this.logEvent('action', message, context);
  }

  logError(message: string, context?: Record<string, unknown>) {
    this.logEvent('error', message, context);
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const entriesToSend = [...this.buffer];
    this.buffer = [];

    if (isElectron() && window.electron?.logEvent) {
      entriesToSend.forEach(entry => window.electron?.logEvent?.(entry));
      return;
    }

    const endpoint = AppConfig.getLogEndpoint();
    if (!endpoint) {
      return;
    }

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entriesToSend),
      });
    } catch (err) {
      // Re-queue on failure
      this.buffer.unshift(...entriesToSend);
    }
  }

  async fetchLogs(): Promise<LogEntry[]> {
    if (isElectron() && window.electron?.fetchLogs) {
      try {
        const remoteLogs = await window.electron.fetchLogs();
        if (Array.isArray(remoteLogs)) return remoteLogs;
      } catch {
        // fall back to local
      }
    }

    return loadLocalLogs();
  }
}

export const LoggerService = new Logger();
