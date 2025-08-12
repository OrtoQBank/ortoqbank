import { useEffect, useState } from 'react';

interface EventSession {
  email: string;
  eventName: string;
  startTime: number;
  expiresAt: number;
}

const SESSION_KEY = 'event-quiz-session';

export function useEventSession(eventName: string) {
  const [session, setSession] = useState<EventSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load session from localStorage on mount
    const loadSession = () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as EventSession;
          
          // Check if session is for the correct event and not expired
          if (parsed.eventName === eventName && Date.now() < parsed.expiresAt) {
            setSession(parsed);
          } else {
            // Clear invalid/expired session
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [eventName]);

  const createSession = (email: string) => {
    const newSession: EventSession = {
      email,
      eventName,
      startTime: Date.now(),
      expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    return newSession;
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const updateSession = (updates: Partial<EventSession>) => {
    if (!session) return;

    const updatedSession = { ...session, ...updates };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
    setSession(updatedSession);
  };

  const getTimeRemaining = () => {
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  };

  const isExpired = () => {
    if (!session) return false;
    return Date.now() >= session.expiresAt;
  };

  return {
    session,
    isLoading,
    createSession,
    clearSession,
    updateSession,
    getTimeRemaining,
    isExpired,
  };
}
