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

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem(AppConfig.userStorageKey);
    const storedId = localStorage.getItem(AppConfig.userIdStorageKey);

    if (storedName) {
      const userId = storedId || generateId();
      localStorage.setItem(AppConfig.userIdStorageKey, userId);
      setCurrentUserState({ displayName: storedName, id: userId });
    }
  }, []);

  const setCurrentUser = (user: User, persist = true) => {
    setCurrentUserState(user);
    if (persist) {
      localStorage.setItem(AppConfig.userStorageKey, user.displayName);
      localStorage.setItem(AppConfig.userIdStorageKey, user.id);
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
