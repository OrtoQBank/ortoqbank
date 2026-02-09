'use client';

import { useQuery } from 'convex/react';
import { createContext, ReactNode, useContext } from 'react';

import { api } from '../../../convex/_generated/api';

/**
 * SessionProvider - Handles session-level state only.
 *
 * Responsibilities:
 * - Terms acceptance status
 * - Loading state for session data
 *
 * NOT responsible for:
 * - Role/permission checks (use useAppRole hook instead)
 * - Tenant identification (use TenantProvider instead)
 */
interface SessionContextType {
  termsAccepted: boolean;
  isLoading: boolean;
}

interface SessionProviderProps {
  children: ReactNode;
}

const SessionContext = createContext<SessionContextType>({
  termsAccepted: true, // Default to true to prevent modal flash
  isLoading: true,
});

export function SessionProvider({ children }: SessionProviderProps) {
  const termsAccepted = useQuery(api.users.getTermsAccepted);

  const isLoading = termsAccepted === undefined;

  const sessionValue: SessionContextType = {
    termsAccepted: termsAccepted ?? true,
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
