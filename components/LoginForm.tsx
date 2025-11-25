import React, { useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../services/config';

type LoginFormProps = {
  onLogin: (displayName: string, persist?: boolean) => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rememberName, setRememberName] = useState(true);
  const [showFirstRun, setShowFirstRun] = useState(false);

  const sharedKey = useMemo(() => AppConfig.getSharedApiKey(), []);

  useEffect(() => {
    const storedName = localStorage.getItem(AppConfig.userStorageKey);
    if (storedName) {
      setDisplayName(storedName);
    }

    const tooltipSeen = localStorage.getItem('nano_login_tooltip_seen');
    if (!tooltipSeen) {
      setShowFirstRun(true);
    }
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError('Please enter a display name to continue.');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Display name should be at least 2 characters long.');
      return;
    }

    if (!/^[\p{L}\p{N}\s'\-]+$/u.test(trimmedName)) {
      setError('Use letters, numbers, spaces, apostrophes, or dashes only.');
      return;
    }

    if (sharedKey) {
      localStorage.setItem(AppConfig.sharedApiKeyStorageKey, sharedKey);
    }

    if (rememberName) {
      localStorage.setItem(AppConfig.userStorageKey, trimmedName);
    } else {
      localStorage.removeItem(AppConfig.userStorageKey);
    }

    onLogin(trimmedName, rememberName);
  };

  return (
    <div className="relative max-w-md w-full space-y-6 bg-white/80 dark:bg-zinc-900/70 p-6 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      {showFirstRun && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm rounded-xl z-20">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 space-y-3 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Getting started</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Just enter the name you want to be addressed by. No technical setup or credentials are needed to begin.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('nano_login_tooltip_seen', 'true');
                setShowFirstRun(false);
              }}
              className="w-full inline-flex justify-center items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Welcome</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter a display name to personalize your session.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Giacomo"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {sharedKey ? (
          <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            A shared API key is configured and will be used for this session.
          </p>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            No shared API key was found in the environment or metadata. Add one to continue calling the API.
          </p>
        )}

        <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white/70 dark:bg-zinc-800/70">
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Remember my name</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Keep this device signed in with the same name.</p>
          </div>
          <button
            type="button"
            onClick={() => setRememberName(!rememberName)}
            className={`w-11 h-6 flex items-center rounded-full transition-colors ${rememberName ? 'bg-blue-600' : 'bg-zinc-400 dark:bg-zinc-600'}`}
            aria-pressed={rememberName}
            aria-label="Toggle remember my name"
          >
            <span
              className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${rememberName ? 'translate-x-5' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Continue
        </button>
      </form>
    </div>
  );
};
