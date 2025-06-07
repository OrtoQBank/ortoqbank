'use client';
import { createContext, ReactNode, useContext } from 'react';

interface SessionData {
  isAdmin: boolean;
  termsAccepted: boolean;
}

interface SessionProviderProps {
  children: ReactNode;
  initialData: SessionData;
}

const SessionContext = createContext<SessionData>({
  isAdmin: false,
  termsAccepted: false,
});

export function SessionProvider({
  children,
  initialData,
}: SessionProviderProps) {
  return (
    <SessionContext.Provider value={initialData}>
      {children}
    </SessionContext.Provider>
  );
}

// Custom hook to use session data
export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
