// src/context/ModeContext.tsx
// Controls active schema mode: Production ('core') vs Test Mode Sandbox ('sandbox')

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ModeContextType {
  isSandbox: boolean;
  setSandbox: (value: boolean) => void;
  toggleSandbox: () => void;
  modeLabel: string;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'unique_ent_mode_is_sandbox';

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSandbox, setIsSandbox] = useState<boolean>(() => {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, String(isSandbox));
  }, [isSandbox]);

  const toggleSandbox = () => setIsSandbox(prev => !prev);

  return (
    <ModeContext.Provider
      value={{
        isSandbox,
        setSandbox: setIsSandbox,
        toggleSandbox,
        modeLabel: isSandbox ? 'TEST MODE (SANDBOX)' : 'PRODUCTION'
      }}
    >
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};
