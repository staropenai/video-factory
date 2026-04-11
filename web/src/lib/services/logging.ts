/**
 * Logging service — captures interactions, decisions, escalations, corrections.
 *
 * [DEFAULT ASSUMPTION] V1 logs to console + in-memory store.
 * Production would persist to a database or analytics service.
 *
 * Extension points:
 * - Replace with Langfuse, PostHog, or custom analytics
 * - Connect to a backend for persistent storage
 * - Add admin review dashboard consumer
 */

export type LogLevel = "info" | "warn" | "error" | "decision" | "escalation";

export interface LogEntry {
  level: LogLevel;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  session_id?: string;
}

// [DEFAULT ASSUMPTION] In-memory log store for V1
const logStore: LogEntry[] = [];

export function log(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
  session_id?: string
): void {
  const entry: LogEntry = {
    level,
    event,
    data,
    timestamp: new Date().toISOString(),
    session_id,
  };
  logStore.push(entry);

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    const prefix = `[${level.toUpperCase()}]`;
    console.log(`${prefix} ${event}`, data);
  }
}

export function getRecentLogs(limit = 50): LogEntry[] {
  return logStore.slice(-limit);
}

export function getLogsBySession(sessionId: string): LogEntry[] {
  return logStore.filter((e) => e.session_id === sessionId);
}

export function getEscalationLogs(): LogEntry[] {
  return logStore.filter((e) => e.level === "escalation");
}

// Convenience methods
export function logDecision(
  event: string,
  data: Record<string, unknown>,
  session_id?: string
) {
  log("decision", event, data, session_id);
}

export function logEscalation(
  event: string,
  data: Record<string, unknown>,
  session_id?: string
) {
  log("escalation", event, data, session_id);
}
