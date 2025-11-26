import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../services/config';

const generateId = () => crypto.randomUUID();

type User = {
  displayName: string;
  id: string;
};

type UserContextValue = {
  currentUser: User | null;
  setCurrentUser: (user: User, persist?: boolean) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

// Username to ID mapping service
const USER_ID_MAP_KEY = 'user_id_mapping';

const getUserIdMap = (): Record<string, string> => {
  const stored = localStorage.getItem(USER_ID_MAP_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveUserIdMap = (map: Record<string, string>) => {
  localStorage.setItem(USER_ID_MAP_KEY, JSON.stringify(map));
};

const getUserIdForName = (displayName: string): string => {
  const map = getUserIdMap();

  // If user already exists, return their ID
  if (map[displayName]) {
    return map[displayName];
  }

  // Create new ID for new user
  const newId = generateId();
  map[displayName] = newId;
  saveUserIdMap(map);
  return newId;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem(AppConfig.userStorageKey);

    if (storedName) {
      // Always use the persistent ID for this username
      const userId = getUserIdForName(storedName);
      setCurrentUserState({ displayName: storedName, id: userId });
    }
  }, []);

  const setCurrentUser = (user: User, persist = true) => {
    // Ensure we use the persistent ID for this username
    const userId = getUserIdForName(user.displayName);
    const userWithPersistentId = { displayName: user.displayName, id: userId };

    setCurrentUserState(userWithPersistentId);
    if (persist) {
      localStorage.setItem(AppConfig.userStorageKey, user.displayName);
      localStorage.setItem(AppConfig.userIdStorageKey, userId);
    } else {
      localStorage.removeItem(AppConfig.userStorageKey);
      localStorage.removeItem(AppConfig.userIdStorageKey);
    }
  };

  const logout = () => {
    setCurrentUserState(null);
    localStorage.removeItem(AppConfig.userStorageKey);
    localStorage.removeItem(AppConfig.userIdStorageKey);
  };

  const value = useMemo(() => ({ currentUser, setCurrentUser, logout }), [currentUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
