import React, { useMemo, useState } from 'react';
import { AppConfig } from '../services/config';

type LoginFormProps = {
  onLogin: (displayName: string) => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sharedKey = useMemo(() => AppConfig.getSharedApiKey(), []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Please enter a display name to continue.');
      return;
    }

    if (sharedKey) {
      localStorage.setItem(AppConfig.sharedApiKeyStorageKey, sharedKey);
    }

    localStorage.setItem(AppConfig.userStorageKey, trimmedName);
    onLogin(trimmedName);
  };

  return (
    <div className="max-w-md w-full space-y-6 bg-white/80 dark:bg-zinc-900/70 p-6 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800">
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
            onChange={(e) => setDisplayName(e.target.value)}
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
