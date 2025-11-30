export type UserSettings = {
  theme: 'dark' | 'light';
  showHistory: boolean;
  showGraphView: boolean;
};

export type UserHistory = {
  lastSessionId: string | null;
  lastMixboardSessionId: string | null;
};

const SETTINGS_KEY = 'app_user_settings';
const HISTORY_KEY = 'app_user_history';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  showHistory: false,
  showGraphView: false
};

const DEFAULT_HISTORY: UserHistory = {
  lastSessionId: null,
  lastMixboardSessionId: null
};

const isElectron = () => {
  // @ts-ignore
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
};

const readFromLocalStorage = <T>(key: string, fallback: T): T => {
  if (typeof localStorage === 'undefined') return fallback;
  const value = localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return { ...fallback, ...(JSON.parse(value) || {}) } as T;
  } catch (err) {
    console.warn(`Failed to parse local storage key ${key}`, err);
    return fallback;
  }
};

const writeToLocalStorage = <T>(key: string, value: T) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist ${key} to localStorage`, err);
  }
};

const applyDefaults = <T>(value: Partial<T> | null | undefined, fallback: T): T => ({
  ...fallback,
  ...(value || {})
});

export const PreferencesService = {
  defaults: DEFAULT_SETTINGS,
  defaultsHistory: DEFAULT_HISTORY,

  subscribeToCacheReady: (callback: (payload: { settings: UserSettings; history: UserHistory }) => void) => {
    if (isElectron()) {
      // @ts-ignore
      window.electron?.onUserCacheReady?.(callback);
    }
  },

  loadSettings: async (): Promise<UserSettings> => {
    if (isElectron()) {
      try {
        // @ts-ignore
        const settings = await window.electron?.loadUserSettings?.();
        return applyDefaults<UserSettings>(settings, DEFAULT_SETTINGS);
      } catch (err) {
        console.warn('Failed to load user settings from Electron cache', err);
      }
    }

    return readFromLocalStorage<UserSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  },

  saveSettings: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    const next = applyDefaults<UserSettings>(settings, DEFAULT_SETTINGS);

    if (isElectron()) {
      try {
        // @ts-ignore
        const saved = await window.electron?.saveUserSettings?.(next);
        return applyDefaults<UserSettings>(saved, next);
      } catch (err) {
        console.warn('Failed to persist settings via Electron cache', err);
      }
    }

    writeToLocalStorage<UserSettings>(SETTINGS_KEY, next);
    return next;
  },

  loadHistory: async (): Promise<UserHistory> => {
    if (isElectron()) {
      try {
        // @ts-ignore
        const history = await window.electron?.loadUserHistory?.();
        return applyDefaults<UserHistory>(history, DEFAULT_HISTORY);
      } catch (err) {
        console.warn('Failed to load user history from Electron cache', err);
      }
    }

    return readFromLocalStorage<UserHistory>(HISTORY_KEY, DEFAULT_HISTORY);
  },

  saveHistory: async (history: Partial<UserHistory>): Promise<UserHistory> => {
    const next = applyDefaults<UserHistory>(history, DEFAULT_HISTORY);

    if (isElectron()) {
      try {
        // @ts-ignore
        const saved = await window.electron?.saveUserHistory?.(next);
        return applyDefaults<UserHistory>(saved, next);
      } catch (err) {
        console.warn('Failed to persist history via Electron cache', err);
      }
    }

    writeToLocalStorage<UserHistory>(HISTORY_KEY, next);
    return next;
  }
};
