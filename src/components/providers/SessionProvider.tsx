'use client';

import { useQuery } from 'convex/react';
import { createContext, ReactNode, useContext } from 'react';

import { api } from '../../../convex/_generated/api';

interface SessionContextType {
  isAdmin: boolean;
  termsAccepted: boolean;
  userRole: string | null;
  isLoading: boolean;
}

interface SessionProviderProps {
  children: ReactNode;
}

const SessionContext = createContext<SessionContextType>({
  isAdmin: false,
  termsAccepted: true, // Default to true to prevent modal flash
  userRole: null,
  isLoading: true,
});

export function SessionProvider({ children }: SessionProviderProps) {
  // Get real-time data from Convex backend
  const userRole = useQuery(api.users.getCurrentUserRole);
  const termsAccepted = useQuery(api.users.getTermsAccepted);
  
  // Calculate derived values
  const isAdmin = userRole === 'admin';
  const isLoading = userRole === undefined || termsAccepted === undefined;

  const sessionValue: SessionContextType = {
    isAdmin,
    termsAccepted: termsAccepted ?? true, // Default to true to prevent modal flash
    userRole: userRole ?? null,
    isLoading,
  };

  return (
    <SessionContext.Provider value={sessionValue}>
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
