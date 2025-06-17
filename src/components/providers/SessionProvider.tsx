'use client';
import { createContext, ReactNode, useContext, useState } from 'react';

interface SessionData {
  isAdmin: boolean;
  termsAccepted: boolean;
}

interface SessionContextType extends SessionData {
  updateTermsAccepted: (accepted: boolean) => void;
}

interface SessionProviderProps {
  children: ReactNode;
  initialData: SessionData;
}

const SessionContext = createContext<SessionContextType>({
  isAdmin: false,
  termsAccepted: false,
  updateTermsAccepted: () => {},
});

export function SessionProvider({
  children,
  initialData,
}: SessionProviderProps) {
  const [sessionData, setSessionData] = useState<SessionData>(initialData);

  const updateTermsAccepted = (accepted: boolean) => {
    setSessionData(prev => ({ ...prev, termsAccepted: accepted }));
  };

  return (
    <SessionContext.Provider value={{ ...sessionData, updateTermsAccepted }}>
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
