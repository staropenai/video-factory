/**
 * Audit logger — structured logging for router decisions and escalations.
 *
 * [Default Assumption] V1 logs to console in structured JSON format.
 * Production would integrate with a logging service (Axiom, Datadog, etc).
 *
 * Every POST /api/router call must produce a log entry.
 * Every escalation state change must produce a log entry.
 */

import type { RouterDecision } from '@/lib/router/types'
import { captureError } from '@/lib/monitoring/sentry'

export type LogLevel = 'info' | 'warn' | 'error' | 'audit'

interface LogEntry {
  timestamp: string
  level: LogLevel
  event: string
  data: Record<string, unknown>
}

function emit(entry: LogEntry): void {
  // [Default Assumption] Console output — production would send to log service
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    console.log(`[${entry.level.toUpperCase()}] ${entry.event}`, entry.data)
  }
}

export interface RouterDecisionLogExtras {
  detectedLanguage?: 'en' | 'zh' | 'ja'
  topFaqId?: string | null
  topFaqCategory?: string | null
  topFaqSubtopic?: string | null
  topScore?: number
  knowledgeFound?: boolean
  matchCount?: number
}

export function logRouterDecision(
  queryText: string,
  decision: RouterDecision,
  sessionId?: string,
  extras?: RouterDecisionLogExtras
): void {
  emit({
    timestamp: new Date().toISOString(),
    level: 'audit',
    event: 'router_decision',
    data: {
      sessionId,
      queryText: queryText.slice(0, 200),
      queryType: decision.queryType,
      answerMode: decision.answerMode,
      riskLevel: decision.riskLevel,
      confidenceBand: decision.confidenceBand,
      shouldEscalate: decision.shouldEscalate,
      selectedRuleKeys: decision.selectedRuleKeys,
      traceTags: decision.traceTags,
      detectedLanguage: extras?.detectedLanguage ?? null,
      topFaqId: extras?.topFaqId ?? null,
      topFaqCategory: extras?.topFaqCategory ?? null,
      topFaqSubtopic: extras?.topFaqSubtopic ?? null,
      topScore: extras?.topScore ?? 0,
      knowledgeFound: extras?.knowledgeFound ?? false,
      matchCount: extras?.matchCount ?? 0,
    },
  })
}

export function logEscalation(
  escalationId: string,
  eventType: string,
  actor: string,
  data?: Record<string, unknown>
): void {
  emit({
    timestamp: new Date().toISOString(),
    level: 'audit',
    event: 'escalation_event',
    data: {
      escalationId,
      eventType,
      actor,
      ...data,
    },
  })
}

export function logError(event: string, error: unknown): void {
  emit({
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    data: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  })
  // Forward to Sentry when configured
  captureError(error, { tags: { event } })
}
