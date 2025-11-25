import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../services/config';

type User = {
  displayName: string;
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
    if (storedName) {
      setCurrentUserState({ displayName: storedName });
    }
  }, []);

  const setCurrentUser = (user: User, persist = true) => {
    setCurrentUserState(user);
    if (persist) {
      localStorage.setItem(AppConfig.userStorageKey, user.displayName);
    } else {
      localStorage.removeItem(AppConfig.userStorageKey);
    }
  };

  const logout = () => {
    setCurrentUserState(null);
    localStorage.removeItem(AppConfig.userStorageKey);
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
