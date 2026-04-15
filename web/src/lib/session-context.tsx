"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

/**
 * Lightweight client-side session context.
 *
 * Provides a session ID and basic state management.
 * No backend dependency — uses sessionStorage only.
 *
 * [Default Assumption] Session is client-side only for new site foundation.
 * When a backend is connected, restore the API session integration from _archive.
 */

interface SessionContextValue {
  sessionId: string | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  sessionId: null,
  loading: true,
});

const SESSION_KEY = "startopenai_session_id";

function generateId(): string {
  return Math.random().toString(36).substring(2, 14);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(SESSION_KEY)
        : null;

    if (stored) {
      setSessionId(stored);
    } else {
      const id = generateId();
      setSessionId(id);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_KEY, id);
      }
    }
    setLoading(false);
  }, []);

  return (
    <SessionContext.Provider value={{ sessionId, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
