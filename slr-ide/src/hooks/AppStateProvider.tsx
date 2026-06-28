'use client';

import React, { createContext, useContext } from 'react';

const AppStateContext = createContext<any>(null);

export function AppStateProvider({ value, children }: { value: any; children: React.ReactNode }) {
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
